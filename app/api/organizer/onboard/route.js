import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role Key to allow profile updates
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

    // 1. Call Paystack to create the Subaccount
    const paystackRes = await fetch('https://api.paystack.co/subaccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_name: business_name,
        settlement_bank: settlement_bank, // e.g., "MTN" or "057"
        account_number: account_number,
        percentage_charge: 5, // Your 5% commission setup
        description: `Ousted Organizer: ${business_name}`
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Paystack subaccount creation failed");
    }

    // In route.js - Update the database section
const subaccountCode = paystackData.data.subaccount_code;

// 1. Update Profile 
// We capture the error as 'dbError' here
const { error: dbError } = await supabaseAdmin
  .from('profiles')
  .update({ 
    paystack_subaccount_code: subaccountCode, 
    is_organizer: true 
  })
  .eq('id', userId);

if (dbError) throw dbError; // Now dbError is defined!

// 2. Update/Insert into Organizers table
// We capture this as 'orgError' to be safe
const { error: orgError } = await supabaseAdmin
  .from('organizers')
  .upsert({ 
    id: userId, 
    business_name: business_name,
    paystack_subaccount_code: subaccountCode 
  });

if (orgError) throw orgError;

    return NextResponse.json({ 
      success: true, 
      subaccount_code: subaccountCode 
    });

  } catch (error) {
    console.error("Onboarding Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
