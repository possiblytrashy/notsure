import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // 1. Get current logged-in user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { business_name, settlement_bank, account_number, percentage_charge } = await request.json();

  try {
    // 2. Call Paystack to create the Subaccount
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
        percentage_charge: 5, // Your 5% commission
        description: `Ousted Organizer: ${business_name}`
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || "Paystack subaccount creation failed");
    }

    const subaccountCode = paystackData.data.subaccount_code;

    // 3. Save the subaccount_code to the organizer's profile in Supabase
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ 
        paystack_subaccount_code: subaccountCode,
        is_organizer: true 
      })
      .eq('id', user.id);

    if (dbError) throw dbError;

    return NextResponse.json({ 
      success: true, 
      subaccount_code: subaccountCode 
    });

  } catch (error) {
    console.error("Onboarding Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
