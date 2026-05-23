// app/api/organizer/payout-update/route.js
// Requires a valid, fresh OTP before allowing any change to payout/banking details.
//
// POST { userId, otp, business_name, settlement_bank, account_number }
//
// Flow:
//   1. Verify OTP is correct and not expired
//   2. Update Paystack subaccount
//   3. Upsert organizers + profiles tables
//   4. Invalidate OTP so it can't be reused

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

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

function hashOtp(otp) {
  const salt = process.env.OTP_SECRET || 'ousted-otp-default-salt';
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, otp, business_name, settlement_bank, account_number } = body;

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!otp)    return NextResponse.json({ error: 'OTP is required' }, { status: 400 });
    if (!business_name || !settlement_bank || !account_number) {
      return NextResponse.json({ error: 'All payout fields are required' }, { status: 400 });
    }

    const supabase = db();

    // ── 1. VERIFY OTP ─────────────────────────────────────────────────────────
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('otp_hash, otp_expires_at, phone_number, phone_verified')
      .eq('id', userId)
      .maybeSingle();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (!profile.phone_verified) {
      return NextResponse.json({ error: 'Phone number is not verified. Please verify your phone first.' }, { status: 403 });
    }

    if (!profile.otp_hash || !profile.otp_expires_at) {
      return NextResponse.json({ error: 'No pending verification. Please request a verification code first.' }, { status: 400 });
    }

    if (new Date(profile.otp_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    const expected = hashOtp(String(otp));
    if (expected !== profile.otp_hash) {
      return NextResponse.json({ error: 'Incorrect verification code.' }, { status: 400 });
    }

    // Invalidate OTP immediately so it cannot be reused
    await supabase
      .from('profiles')
      .update({ otp_hash: null, otp_expires_at: null })
      .eq('id', userId);

    // ── 2. GET USER EMAIL ─────────────────────────────────────────────────────
    let userEmail = null;
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      userEmail = user?.email || null;
    } catch {}

    // ── 3. PAYSTACK SUBACCOUNT UPDATE/CREATE ──────────────────────────────────
    const { data: existingOrg }     = await supabase.from('organizers').select('paystack_subaccount_code').eq('user_id', userId).maybeSingle();
    const { data: existingProfile } = await supabase.from('profiles').select('paystack_subaccount_code').eq('id', userId).maybeSingle();
    const existingCode = existingOrg?.paystack_subaccount_code || existingProfile?.paystack_subaccount_code;

    let subaccountCode = null;

    if (existingCode) {
      const updateRes = await fetch(`https://api.paystack.co/subaccount/${existingCode}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name, settlement_bank, account_number, primary_contact_email: userEmail || '' }),
      });
      const updateData = await updateRes.json();
      subaccountCode = existingCode;
      console.log('[PayoutUpdate] Updated Paystack subaccount:', existingCode, updateData.status ? '✓' : '(partial)');
    } else {
      const paystackRes = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name, settlement_bank, account_number,
          percentage_charge: 95,
          description: `OUSTED Organizer: ${business_name}`,
          primary_contact_email: userEmail || '',
          metadata: { user_id: userId, role: 'organizer' },
        }),
      });
      const paystackData = await paystackRes.json();
      if (!paystackData.status) throw new Error(paystackData.message || 'Paystack subaccount creation failed');
      subaccountCode = paystackData.data.subaccount_code;
      console.log('[PayoutUpdate] Created Paystack subaccount:', subaccountCode);
    }

    // ── 4. BUILD PAYMENT FIELDS ───────────────────────────────────────────────
    const momoPayment = isMoMo(settlement_bank);
    const paymentFields = momoPayment ? {
      mobile_money_provider: MOMO_PROVIDER_NAMES[settlement_bank.toLowerCase()] || settlement_bank,
      mobile_money_number: account_number,
      bank_code: null, account_number: null,
    } : {
      bank_code: settlement_bank, account_number,
      mobile_money_provider: null, mobile_money_number: null,
    };

    // ── 5. UPSERT ORGANIZERS ──────────────────────────────────────────────────
    const { error: orgErr } = await supabase.from('organizers').upsert({
      user_id: userId,
      name: business_name, business_name,
      contact_email: userEmail,
      paystack_subaccount_code: subaccountCode,
      default_subaccount_code: subaccountCode,
      is_verified: true,
      ...paymentFields,
    }, { onConflict: 'user_id' });

    if (orgErr) {
      if (orgErr.code === '23505') {
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

    // ── 6. SYNC PROFILES ──────────────────────────────────────────────────────
    await supabase.from('profiles').upsert({
      id: userId,
      business_name,
      paystack_subaccount_code: subaccountCode,
      bank_code: paymentFields.bank_code,
      account_number: paymentFields.account_number,
      is_organizer: true,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false });

    console.log(`[PayoutUpdate] ✅ Payout settings updated for user ${userId}`);
    return NextResponse.json({ success: true, subaccount_code: subaccountCode });

  } catch (err) {
    console.error('[PayoutUpdate] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
