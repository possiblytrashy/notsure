import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { account_number, bank_code, type, user_id } = await req.json();
    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

    // 1. Verify Account Name with Paystack
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const resolveData = await resolveRes.json();
    if (!resolveData.status) return NextResponse.json({ error: "Invalid Account" }, { status: 400 });

    // 2. Create Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type || "ghipss",
        name: resolveData.data.account_name,
        account_number,
        bank_code,
        currency: "GHS",
      }),
    });
    const recipientData = await recipientRes.json();

    return NextResponse.json({
      recipient_code: recipientData.data.recipient_code,
      account_name: resolveData.data.account_name
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
