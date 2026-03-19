// NFC write API — returns the signed payload to write to an NFC tag
// Client calls this, then uses Web NFC API to write the returned data
// Format written to tag: "REF:{reference}|SIG:{hmac}" — same as QR
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'ousted-qr-secret-CHANGE-IN-PROD';

function signRef(reference) {
  return crypto.createHmac('sha256', QR_SECRET).update(reference).digest('hex').substring(0, 16);
}

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('ref');
  const email = searchParams.get('email');

  if (!reference || !email) {
    return NextResponse.json({ error: 'Missing ref or email' }, { status: 400 });
  }

  const db = getDb();

  // Verify ownership
  const { data: ticket } = await db
    .from('tickets')
    .select('id,reference,status,guest_name,tier_name,event_id,events!event_id(title,date,location)')
    .eq('reference', reference)
    .eq('guest_email', email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  if (ticket.status !== 'valid') return NextResponse.json({ error: 'Ticket not valid' }, { status: 400 });

  const sig = signRef(reference);
  const nfcPayload = `REF:${reference}|SIG:${sig}`;

  // Also return a deep link URL as fallback for NFC taps on non-scanner devices
  const deepLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live'}/verify?ref=${encodeURIComponent(reference)}&sig=${sig}`;

  return NextResponse.json({
    nfc_payload: nfcPayload,           // write this to NDEF text record
    deep_link: deepLink,               // write this as NDEF URI record for non-gate devices
    reference,
    event_title: ticket.events?.title,
    guest_name: ticket.guest_name,
  });
}
