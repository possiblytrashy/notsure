import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  const { amount, email, phone, eventId, organizerSubaccount } = await req.json();

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: amount * 100, // Paystack uses pesewas/kobo (Amount * 100)
        currency: "GHS",
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/verify`,
        metadata: {
          event_id: eventId,
          custom_fields: [{ display_name: "Phone", variable_name: "phone", value: phone }]
        },
        // Automatic Split: Organizer gets their share, you get your commission
        subaccount: organizerSubaccount, 
        bearer: "subaccount" // The organizer pays the Paystack fee
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return NextResponse.json({ url: response.data.data.authorization_url });
  } catch (error) {
    console.error(error.response?.data);
    return NextResponse.json({ error: 'Paystack Init Failed' }, { status: 500 });
  }
}
