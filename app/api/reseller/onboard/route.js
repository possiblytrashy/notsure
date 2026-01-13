// FILE: app/api/reseller/onboard/route.js
// NEW FILE - Creates Paystack subaccount and reseller profile

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { business_name, settlement_bank, account_number, phone } = await req.json();

    // Validation
    if (!business_name || !settlement_bank || !account_number) {
      return NextResponse.json({ 
        error: 'All fields are required' 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Check if user is already a reseller
    const { data: existing } = await supabase
      .from('resellers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ 
        error: 'You are already a reseller' 
      }, { status: 400 });
    }

    console.log('Creating Paystack subaccount for:', user.email);

    // 1. Create Paystack Subaccount
    const paystackPayload = {
      business_name: business_name,
      settlement_bank: settlement_bank,
      account_number: account_number,
      percentage_charge: 10, // Reseller gets 10% of marked-up price
      description: `Reseller: ${user.email}`,
      primary_contact_email: user.email,
      primary_contact_name: business_name,
      primary_contact_phone: phone || '',
      metadata: {
        user_id: user.id,
        email: user.email,
        role: 'reseller'
      }
    };

    const paystackRes = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    const paystackResult = await paystackRes.json();

    if (!paystackRes.ok || !paystackResult.status) {
      console.error('Paystack subaccount creation failed:', paystackResult);
      return NextResponse.json({ 
        error: paystackResult.message || 'Failed to create payment account. Please check your bank details.' 
      }, { status: 400 });
    }

    const subaccountCode = paystackResult.data.subaccount_code;
    console.log('✅ Paystack subaccount created:', subaccountCode);

    // 2. Create Reseller Profile in Database
    const { data: reseller, error: insertError } = await supabase
      .from('resellers')
      .insert({
        user_id: user.id,
        paystack_subaccount_code: subaccountCode,
        bank_name: settlement_bank,
        account_number: account_number,
        is_active: true,
        total_earned: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert failed:', insertError);
      // Try to delete the Paystack subaccount to avoid orphans
      await fetch(`https://api.paystack.co/subaccount/${subaccountCode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });
      
      return NextResponse.json({ 
        error: 'Failed to create reseller profile' 
      }, { status: 500 });
    }

    console.log('✅ Reseller profile created:', reseller.id);

    return NextResponse.json({ 
      success: true,
      reseller: {
        id: reseller.id,
        subaccount_code: subaccountCode
      }
    });

  } catch (err) {
    console.error('Onboarding error:', err);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: err.message 
    }, { status: 500 });
  }
}
