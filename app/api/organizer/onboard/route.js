// FILE: app/api/organizer/onboard/route.js
// FIXED - Correct split percentages and proper database updates

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { business_name, settlement_bank, account_number, userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 401 });
    }

    if (!business_name || !settlement_bank || !account_number) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    console.log('Creating organizer subaccount for user:', userId);

    // 1. Call Paystack to create the Subaccount
    const paystackPayload = {
      business_name: business_name,
      settlement_bank: settlement_bank,
      account_number: account_number,
      percentage_charge: 95, // ✅ ORGANIZER GETS 95% (was 5% - this was the bug!)
      description: `Ousted Organizer: ${business_name}`,
      primary_contact_email: '', // We'll set this if needed
      metadata: {
        user_id: userId,
        role: 'organizer'
      }
    };

    const paystackRes = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error('Paystack error:', paystackData);
      throw new Error(paystackData.message || "Paystack subaccount creation failed");
    }

    const subaccountCode = paystackData.data.subaccount_code;
    console.log('✅ Paystack subaccount created:', subaccountCode);

    // 2. Update the Profiles table (for UI/Auth checks)
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: userId,
        paystack_subaccount_code: subaccountCode,
        business_name: business_name,
        bank_code: settlement_bank,
        account_number: account_number,
        is_organizer: true,
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'id' 
      });

    if (profileErr) {
      console.error('Profile update error:', profileErr);
      throw profileErr;
    }

    console.log('✅ Profile updated');

    // 3. Update/Create Organizers table entry
    // First check if organizer profile exists
    const { data: existingOrg } = await supabaseAdmin
      .from('organizers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingOrg) {
      // Update existing organizer
      const { error: orgUpdateErr } = await supabaseAdmin
        .from('organizers')
        .update({ 
          business_name: business_name,
          paystack_subaccount_code: subaccountCode
        })
        .eq('user_id', userId);

      if (orgUpdateErr) {
        console.error('Organizer update error:', orgUpdateErr);
        throw orgUpdateErr;
      }
    } else {
      // Create new organizer profile
      const { error: orgCreateErr } = await supabaseAdmin
        .from('organizers')
        .insert({ 
          user_id: userId, // ✅ Use user_id, not id
          business_name: business_name,
          paystack_subaccount_code: subaccountCode,
          is_verified: true
        });

      if (orgCreateErr) {
        console.error('Organizer create error:', orgCreateErr);
        throw orgCreateErr;
      }
    }

    console.log('✅ Organizer profile updated');

    return NextResponse.json({ 
      success: true, 
      subaccount_code: subaccountCode 
    });

  } catch (error) {
    console.error("Onboarding Error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}
