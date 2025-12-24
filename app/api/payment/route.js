import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  const { amount, email, phone, eventId, userId } = await req.json();

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: `TX-${Date.now()}`,
        amount: amount,
        currency: 'GHS', // Change based on region
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
        customer: { email, phonenumber: phone },
        meta: { eventId, userId }, // Pass data to retrieve later
        customizations: {
          title: "Lumina Tickets",
          logo: "https://your-logo-url.com/logo.png"
        }
      },
      { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
    );

    return NextResponse.json({ link: response.data.data.link });
  } catch (error) {
    return NextResponse.json({ error: 'Payment init failed' }, { status: 500 });
  }
}
