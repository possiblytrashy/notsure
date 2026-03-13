// Returns the signed QR data string for a ticket
// Client fetches this, then renders the QR from the signed string
// The HMAC signature means any QR not generated here will be rejected at the gate

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'ousted-qr-secret-CHANGE-IN-PROD';

function signRef(reference) {
  return crypto.createHmac('sha256', QR_SECRET).update(reference).digest('hex').substring(0, 16);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('ref');
  const email = searchParams.get('email'); // used to verify ownership

  if (!reference || !email) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Verify this reference belongs to this email
  const { data: ticket } = await supabase
    .from('tickets')
    .select('reference, guest_email, status')
    .eq('reference', reference)
    .eq('guest_email', email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found or not yours' }, { status: 404 });
  if (ticket.status !== 'valid') return NextResponse.json({ error: 'Ticket is not valid' }, { status: 400 });

  const sig = signRef(reference);
  const qrData = `REF:${reference}|SIG:${sig}`;

  return NextResponse.json({ qr_data: qrData });
}
