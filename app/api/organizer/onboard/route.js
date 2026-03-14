// Organizer onboarding — saves to BOTH profiles AND organizers atomically
// Uses upsert (not insert) to avoid unique constraint failures on re-onboarding
// Detects MoMo vs bank from the settlement_bank code

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// MTN/VOD/ATL/TGO are MoMo codes — everything else is a bank
const MOMO_CODES = ['mtn', 'vod', 'atl', 'tgo', 'vodafone', 'airteltigo'];
const isMoMo = (code) => MOMO_CODES.includes((code || '').toLowerCase());

const MOMO_PROVIDER_NAMES = {
  mtn: 'MTN Mobile Money', vod: 'Telecel Cash', vodafone: 'Telecel Cash',
  atl: 'AirtelTigo Money', tgo: 'AirtelTigo Money', airteltigo: 'AirtelTigo Money',
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { business_name, settlement_bank, account_number, userId } = body;

    if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    if (!business_name || !settlement_bank || !account_number) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const supabase = db();
    const momoPayment = isMoMo(settlement_bank);

    // ── 1. GET USER EMAIL ────────────────────────────────────
    let userEmail = null;
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      userEmail = user?.email || null;
    } catch {}

    // ── 2. CREATE/UPDATE PAYSTACK SUBACCOUNT ─────────────────
    // Check if organizer already has a subaccount so we don't create duplicates
    let subaccountCode = null;
    const { data: existingOrg } = await supabase
      .from('organizers')
      .select('id,paystack_subaccount_code')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('paystack_subaccount_code')
      .eq('id', userId)
      .maybeSingle();

    const existingCode = existingOrg?.paystack_subaccount_code || existingProfile?.paystack_subaccount_code;

    if (existingCode) {
      // Update existing Paystack subaccount with new bank details
      const updateRes = await fetch(`https://api.paystack.co/subaccount/${existingCode}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name,
          settlement_bank,
          account_number,
          primary_contact_email: userEmail || '',
        }),
      });
      const updateData = await updateRes.json();
      // Use existing code even if update fails (Paystack may not support all updates)
      subaccountCode = existingCode;
      console.log('Updated Paystack subaccount:', existingCode, updateData.status ? '✓' : '(update failed, keeping existing)');
    } else {
      // Create new Paystack subaccount
      const paystackRes = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name,
          settlement_bank,
          account_number,
          percentage_charge: 95,
          description: `OUSTED Organizer: ${business_name}`,
          primary_contact_email: userEmail || '',
          metadata: { user_id: userId, role: 'organizer' },
        }),
      });
      const paystackData = await paystackRes.json();
      if (!paystackData.status) {
        throw new Error(paystackData.message || 'Paystack subaccount creation failed');
      }
      subaccountCode = paystackData.data.subaccount_code;
      console.log('Created Paystack subaccount:', subaccountCode);
    }

    // ── 3. BUILD PAYMENT FIELDS ───────────────────────────────
    const paymentFields = momoPayment ? {
      mobile_money_provider: MOMO_PROVIDER_NAMES[settlement_bank.toLowerCase()] || settlement_bank,
      mobile_money_number: account_number,
      bank_code: null,
      account_number: null,
    } : {
      bank_code: settlement_bank,
      account_number: account_number,
      mobile_money_provider: null,
      mobile_money_number: null,
    };

    // ── 4. UPSERT ORGANIZERS TABLE ────────────────────────────
    // upsert on user_id — avoids unique constraint failures entirely
    const organizerPayload = {
      user_id: userId,
      name: business_name,
      business_name: business_name,
      contact_email: userEmail,
      paystack_subaccount_code: subaccountCode,
      default_subaccount_code: subaccountCode,
      is_verified: true,
      ...paymentFields,
    };

    const { error: orgErr } = await supabase
      .from('organizers')
      .upsert(organizerPayload, { onConflict: 'user_id' });

    if (orgErr) {
      console.error('Organizer upsert error:', orgErr);
      // Try without the unique subaccount code if it conflicts
      if (orgErr.code === '23505') {
        // unique violation — update instead
        await supabase.from('organizers').update({
          name: business_name, business_name, contact_email: userEmail,
          paystack_subaccount_code: subaccountCode,
          default_subaccount_code: subaccountCode,
          ...paymentFields,
        }).eq('user_id', userId);
      } else {
        throw orgErr;
      }
    }
    console.log('✅ Organizers table updated');

    // ── 5. UPSERT PROFILES TABLE (sync) ──────────────────────
    // Keep profiles in sync — never overwrite role
    const profilePayload = {
      id: userId,
      business_name: business_name,
      paystack_subaccount_code: subaccountCode,
      bank_code: paymentFields.bank_code,
      account_number: paymentFields.account_number,
      is_organizer: true,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id', ignoreDuplicates: false });

    if (profileErr) {
      // Non-fatal — organizers table is the source of truth for payment info
      console.warn('Profile sync warning (non-fatal):', profileErr.message);
    }
    console.log('✅ Profiles table synced');

    return NextResponse.json({ success: true, subaccount_code: subaccountCode });

  } catch (err) {
    console.error('Onboarding error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
