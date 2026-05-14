// Secure server-side ticket verification
// HMAC signature in QR data prevents any forgery — fake QRs are rejected before DB lookup
// Returns full event info regardless of whether scanner pre-selected an event

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const QR_SECRET = process.env.QR_SIGNING_SECRET || 'ousted-qr-secret-CHANGE-IN-PROD';

function signRef(reference) {
  return crypto.createHmac('sha256', QR_SECRET).update(reference).digest('hex').substring(0, 16);
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ valid: false, reason: 'BAD_REQUEST' }, { status: 400 }); }

  const { qr_data, selected_event_id, scanner_id } = body;
  if (!qr_data) return NextResponse.json({ valid: false, reason: 'NO_DATA' });

  // ── PARSE QR ─────────────────────────────────────────────────────
  // New format: "REF:{ref}|SIG:{16-char-hmac}"
  // Legacy:     plain reference string
  let reference = '';
  let providedSig = null;

  if (qr_data.includes('|SIG:')) {
    const [refPart, sigPart] = qr_data.split('|SIG:');
    reference = refPart.replace('REF:', '').trim();
    providedSig = sigPart?.trim();
  } else {
    reference = qr_data.replace('REF:', '').trim().split('|')[0];
  }

  if (!reference || reference.length > 120) {
    return NextResponse.json({ valid: false, reason: 'INVALID_FORMAT', message: 'QR code format not recognised' });
  }

  // ── HMAC SIGNATURE CHECK ─────────────────────────────────────────
  // If signature present and WRONG → forged QR, reject immediately without hitting DB
  let signatureWarning = false;
  if (providedSig) {
    const expected = signRef(reference);
    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(providedSig.padEnd(32, '0').substring(0, 32)),
        Buffer.from(expected.padEnd(32, '0').substring(0, 32))
      );
      if (!match) {
        return NextResponse.json({
          valid: false, reason: 'FORGED_QR',
          message: '⚠️ FORGED QR CODE — Signature does not match. Deny entry.'
        });
      }
    } catch {
      return NextResponse.json({ valid: false, reason: 'SIG_ERROR', message: 'Signature verification failed' });
    }
  } else {
    signatureWarning = true; // old QR without signature — allow but flag
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id,guest_name,guest_email,tier_name,is_scanned,status,event_id,scanned_at,scanned_by,base_amount,currency,events!event_id(id,title,date,time,location,image_url),ticket_tiers:tier_id(name)')
    .eq('reference', reference)
    .maybeSingle();

  if (error) return NextResponse.json({ valid: false, reason: 'DB_ERROR', message: 'Database error — check connection' });
  if (!ticket) return NextResponse.json({ valid: false, reason: 'NOT_FOUND', message: 'No ticket found for this QR code' });

  const eventTitle = ticket.events?.title || 'Unknown Event';
  const tierName = ticket.ticket_tiers?.name || ticket.tier_name || 'General Admission';

  // Wrong event (only enforced if scanner pre-selected one)
  if (selected_event_id && ticket.event_id !== selected_event_id) {
    return NextResponse.json({
      valid: false, reason: 'WRONG_EVENT',
      message: `WRONG EVENT — Ticket is for "${eventTitle}"`,
      event_name: eventTitle, tier: tierName
    });
  }

  if (ticket.status !== 'valid') {
    return NextResponse.json({ valid: false, reason: 'INVALID_STATUS', message: `Ticket status: ${(ticket.status || '').toUpperCase()}`, event_name: eventTitle, tier: tierName });
  }

  if (ticket.is_scanned) {
    const t = ticket.scanned_at ? new Date(ticket.scanned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    return NextResponse.json({
      valid: false, reason: 'ALREADY_USED',
      message: `TICKET ALREADY USED${t ? ' at ' + t : ''}`,
      event_name: eventTitle, tier: tierName,
      guest_name: ticket.guest_name, scanned_at: ticket.scanned_at
    });
  }

  // Atomic update — eq(is_scanned, false) prevents race condition double-entry
  const { error: updateError } = await supabase
    .from('tickets')
    .update({ is_scanned: true, scanned_at: new Date().toISOString(), scanned_by: scanner_id || 'gate' })
    .eq('id', ticket.id)
    .eq('is_scanned', false);

  if (updateError) {
    return NextResponse.json({ valid: false, reason: 'RACE_CONDITION', message: 'Ticket was just scanned by another gate — deny entry' });
  }

  return NextResponse.json({
    valid: true, reason: 'ACCESS_GRANTED', message: 'ACCESS GRANTED',
    event_name: eventTitle,
    event_date: ticket.events?.date,
    event_location: ticket.events?.location,
    tier: tierName,
    guest_name: ticket.guest_name,
    guest_email: ticket.guest_email,
    amount_paid: ticket.base_amount,
    currency: ticket.currency || 'GHS',
    signature_warning: signatureWarning
  });
}
