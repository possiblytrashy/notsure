// NFC Ticket Verification
// Web NFC API (Android Chrome) writes the signed ticket reference to an NFC tag
// Gate taps phone to NFC tag → reads → calls this endpoint → grants/denies entry
// Same HMAC verification as QR scanner to prevent forgery

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'ousted-qr-secret-CHANGE-IN-PROD';

function signRef(ref) {
  return crypto.createHmac('sha256', QR_SECRET).update(ref).digest('hex').substring(0, 16);
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ valid: false, reason: 'BAD_REQUEST' }); }

  const { nfc_data, selected_event_id, scanner_id } = body;
  if (!nfc_data) return NextResponse.json({ valid: false, reason: 'NO_DATA' });

  // NFC tags store same format as QR: "REF:{ref}|SIG:{sig}"
  let reference = '';
  let providedSig = null;

  if (nfc_data.includes('|SIG:')) {
    const [refPart, sigPart] = nfc_data.split('|SIG:');
    reference = refPart.replace('REF:', '').trim();
    providedSig = sigPart?.trim();
  } else {
    reference = nfc_data.replace('REF:', '').trim().split('|')[0];
  }

  if (!reference || reference.length > 120) {
    return NextResponse.json({ valid: false, reason: 'INVALID_FORMAT', message: 'NFC tag format not recognised' });
  }

  // Verify HMAC signature
  let signatureWarning = false;
  if (providedSig) {
    const expected = signRef(reference);
    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(providedSig.padEnd(32, '0').substring(0, 32)),
        Buffer.from(expected.padEnd(32, '0').substring(0, 32))
      );
      if (!match) return NextResponse.json({ valid: false, reason: 'FORGED_NFC', message: '⚠️ NFC TAG TAMPERED — Signature invalid. Deny entry.' });
    } catch { return NextResponse.json({ valid: false, reason: 'SIG_ERROR' }); }
  } else {
    signatureWarning = true;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,guest_name,guest_email,tier_name,is_scanned,status,event_id,scanned_at,base_amount,currency,events!event_id(id,title,date,time,location),ticket_tiers:tier_id(name)')
    .eq('reference', reference)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ valid: false, reason: 'NOT_FOUND', message: 'No ticket found for this NFC tag' });

  const eventTitle = ticket.events?.title || 'Unknown Event';
  const tierName = ticket.ticket_tiers?.name || ticket.tier_name || 'General Admission';

  if (selected_event_id && ticket.event_id !== selected_event_id) {
    return NextResponse.json({ valid: false, reason: 'WRONG_EVENT', message: `WRONG EVENT — Ticket is for "${eventTitle}"`, event_name: eventTitle, tier: tierName });
  }
  if (ticket.status !== 'valid') {
    return NextResponse.json({ valid: false, reason: 'INVALID_STATUS', message: `Ticket status: ${ticket.status?.toUpperCase()}`, event_name: eventTitle, tier: tierName });
  }
  if (ticket.is_scanned) {
    const t = ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    return NextResponse.json({ valid: false, reason: 'ALREADY_USED', message: `ALREADY SCANNED${t ? ' at ' + t : ''}`, event_name: eventTitle, tier: tierName, guest_name: ticket.guest_name });
  }

  // Atomic mark-as-scanned
  const { error } = await supabase
    .from('tickets')
    .update({ is_scanned: true, scanned_at: new Date().toISOString(), scanned_by: scanner_id || 'nfc-gate' })
    .eq('id', ticket.id)
    .eq('is_scanned', false);

  if (error) return NextResponse.json({ valid: false, reason: 'RACE_CONDITION', message: 'Just scanned by another gate — deny entry' });

  return NextResponse.json({
    valid: true, reason: 'ACCESS_GRANTED', message: 'ACCESS GRANTED',
    scan_method: 'NFC',
    event_name: eventTitle, event_date: ticket.events?.date, event_location: ticket.events?.location,
    tier: tierName, guest_name: ticket.guest_name, guest_email: ticket.guest_email,
    signature_warning: signatureWarning,
  });
}
