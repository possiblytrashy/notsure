import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  const { type, id, email, phone, amount, subaccount } = await req.json();

  try {
    const payload = {
      tx_ref: `LMN-${Date.now()}`,
      amount: amount,
      currency: "GHS",
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/verify`,
      customer: { email, phonenumber: phone },
      // The Magic: Split Payment
      subaccounts: [{ id: subaccount }], 
      meta: { type, target_id: id } 
    };

    const res = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
    });

    return NextResponse.json({ url: res.data.data.link });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
