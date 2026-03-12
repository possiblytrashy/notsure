import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { account_number, bank_code, type } = await req.json();
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

    // 1. Log for Vercel Debugging (See exactly what Paystack receives)
    console.log(`Resolving: ${account_number} for Bank Code: ${bank_code}`);

    // 2. Verify Account Name with Paystack
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { 
        headers: { 
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json'
        } 
      }
    );

    const resolveData = await resolveRes.json();

    // If Paystack fails, return THEIR specific error message for better debugging
    if (!resolveData.status) {
      console.error("Paystack Resolve Error:", resolveData.message);
      return NextResponse.json(
        { error: resolveData.message || "Invalid Account" }, 
        { status: 400 }
      );
    }

    // 3. Create Recipient
    // For Ghana: MoMo must be "mobile_money", Banks must be "ghipss"
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type || (['MTN', 'VOD', 'ATL'].includes(bank_code) ? "mobile_money" : "ghipss"),
        name: resolveData.data.account_name,
        account_number: account_number,
        bank_code: bank_code,
        currency: "GHS",
      }),
    });

    const recipientData = await recipientRes.json();

    if (!recipientData.status) {
      return NextResponse.json({ error: "Could not create payout recipient" }, { status: 400 });
    }

    return NextResponse.json({
      recipient_code: recipientData.data.recipient_code,
      account_name: resolveData.data.account_name
    });

  } catch (error) {
    console.error("Internal API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
