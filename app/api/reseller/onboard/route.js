// FILE: app/api/reseller/onboard/route.js
// UPDATED - Creates Paystack subaccount with Mobile Money or Bank support

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const body = await req.json();
    const { 
      business_name, 
      phone, 
      payment_method,
      // Mobile Money
      mobile_money_provider,
      mobile_money_number,
      // Bank
      settlement_bank, 
      account_number 
    } = body;

    // Validation
    if (!business_name || !phone || !payment_method) {
      return NextResponse.json({ 
        error: 'Business name, phone, and payment method are required' 
      }, { status: 400 });
    }

    // Validate based on payment method
    if (payment_method === 'mobile_money') {
      if (!mobile_money_provider || !mobile_money_number) {
        return NextResponse.json({ 
          error: 'Mobile money provider and number are required' 
        }, { status: 400 });
      }
    } else if (payment_method === 'bank') {
      if (!settlement_bank || !account_number) {
        return NextResponse.json({ 
          error: 'Bank and account number are required' 
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({ 
        error: 'Invalid payment method' 
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

    console.log(`Creating Paystack subaccount for: ${user.email} (${payment_method})`);

    // Build Paystack payload based on payment method
    let paystackPayload = {
      business_name: business_name,
      percentage_charge: 10, // Reseller gets 10% of marked-up price
      description: `Reseller: ${user.email}`,
      primary_contact_email: user.email,
      primary_contact_name: business_name,
      primary_contact_phone: phone,
      metadata: {
        user_id: user.id,
        email: user.email,
        role: 'reseller',
        payment_method: payment_method
      }
    };

    // Add payment-specific fields
    if (payment_method === 'mobile_money') {
      // Map provider codes to Paystack bank codes
      const mobileMoneyBankCodes = {
        'mtn': 'MTN',  // MTN Mobile Money
        'vod': 'VOD',  // Vodafone Cash
        'tgo': 'ATL'   // AirtelTigo Money
      };

      paystackPayload.settlement_bank = mobileMoneyBankCodes[mobile_money_provider];
      paystackPayload.account_number = mobile_money_number;
      
      // Store additional info in metadata
      paystackPayload.metadata.mobile_money_provider = mobile_money_provider;
    } else {
      // Bank account
      paystackPayload.settlement_bank = settlement_bank;
      paystackPayload.account_number = account_number;
    }

    // Create Paystack Subaccount
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
      
      // Provide helpful error messages
      let errorMsg = 'Failed to create payment account. ';
      if (payment_method === 'mobile_money') {
        errorMsg += 'Please verify your mobile money number is correct and active.';
      } else {
        errorMsg += 'Please check your bank details are correct.';
      }
      
      return NextResponse.json({ 
        error: paystackResult.message || errorMsg 
      }, { status: 400 });
    }

    const subaccountCode = paystackResult.data.subaccount_code;
    console.log('✅ Paystack subaccount created:', subaccountCode);

    // Create Reseller Profile in Database
    const resellerData = {
      user_id: user.id,
      paystack_subaccount_code: subaccountCode,
      is_active: true,
      total_earned: 0,
      payment_method: payment_method
    };

    // Add payment-specific data
    if (payment_method === 'mobile_money') {
      resellerData.mobile_money_provider = mobile_money_provider;
      resellerData.mobile_money_number = mobile_money_number;
    } else {
      resellerData.bank_name = settlement_bank;
      resellerData.account_number = account_number;
    }

    const { data: reseller, error: insertError } = await supabase
      .from('resellers')
      .insert(resellerData)
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
        subaccount_code: subaccountCode,
        payment_method: payment_method
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
