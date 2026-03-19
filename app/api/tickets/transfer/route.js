// Ticket transfer between users
// Original buyer can transfer a ticket to a new email before the event
// Generates a signed transfer token, sends email to recipient to accept

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
const TRANSFER_SECRET = process.env.QR_SIGNING_SECRET || 'ousted-transfer-secret';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

// POST /api/tickets/transfer — initiate a transfer
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { reference, current_email, recipient_email } = body;

  if (!reference || !current_email || !recipient_email) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (current_email.toLowerCase() === recipient_email.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email)) {
    return NextResponse.json({ error: 'Invalid recipient email' }, { status: 400 });
  }

  const supabase = db();

  // Verify ownership
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id,guest_name,tier_name,status,is_scanned,event_id,events!event_id(title,date,location)')
    .eq('reference', reference)
    .eq('guest_email', current_email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found or not yours' }, { status: 404 });
  if (ticket.status !== 'valid') return NextResponse.json({ error: 'Only valid tickets can be transferred' }, { status: 400 });
  if (ticket.is_scanned) return NextResponse.json({ error: 'Already scanned — cannot transfer' }, { status: 400 });

  // Check event hasn't started
  if (ticket.events?.date && new Date(ticket.events.date) < new Date()) {
    return NextResponse.json({ error: 'Cannot transfer a ticket for a past event' }, { status: 400 });
  }

  // Generate time-limited transfer token (24h)
  const tokenData = `${reference}:${current_email.toLowerCase()}:${recipient_email.toLowerCase()}:${Math.floor(Date.now() / 86400000)}`;
  const token = crypto.createHmac('sha256', TRANSFER_SECRET).update(tokenData).digest('hex').substring(0, 32);

  // Store pending transfer
  await supabase.from('ticket_transfers').upsert({
    reference,
    from_email: current_email.toLowerCase(),
    to_email: recipient_email.toLowerCase(),
    token,
    status: 'pending',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    event_title: ticket.events?.title,
  }, { onConflict: 'reference' }).catch(() => {});

  // Send email via Resend if configured
  if (process.env.RESEND_API_KEY) {
    const acceptUrl = `${SITE_URL}/tickets/transfer/accept?token=${token}&ref=${reference}`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OUSTED <tickets@ousted.live>',
        to: [recipient_email],
        subject: `🎟️ ${ticket.guest_name || 'Someone'} is sending you a ticket for ${ticket.events?.title || 'an event'}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050505;color:#fff;border-radius:24px">
            <h1 style="font-size:28px;font-weight:900;margin:0 0 8px;letter-spacing:-1px">You've received a ticket! 🎟️</h1>
            <p style="color:#999;margin:0 0 24px">${ticket.guest_name || 'Someone'} wants to transfer their ticket to you</p>
            <div style="background:#111;border-radius:18px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,.08)">
              <p style="margin:0 0 4px;font-size:20px;font-weight:900">${ticket.events?.title || 'Event'}</p>
              <p style="margin:0 0 2px;color:#888;font-size:14px">📅 ${ticket.events?.date ? new Date(ticket.events.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : 'TBA'}</p>
              <p style="margin:0;color:#888;font-size:14px">📍 ${ticket.events?.location || 'TBA'}</p>
            </div>
            <a href="${acceptUrl}" style="display:block;background:linear-gradient(135deg,#CDA434,#7a5c1e);color:#000;text-decoration:none;padding:16px;border-radius:14px;text-align:center;font-weight:900;font-size:16px;margin-bottom:16px">
              ACCEPT TICKET →
            </a>
            <p style="color:#555;font-size:12px;text-align:center">This link expires in 24 hours. Once accepted, the ticket will be transferred to your account.</p>
          </div>`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, message: `Transfer email sent to ${recipient_email}. They have 24 hours to accept.`, token });
}

// GET /api/tickets/transfer?token=...&ref=... — accept a transfer
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const ref = searchParams.get('ref');
  const accept = searchParams.get('accept');

  if (!token || !ref) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  if (accept !== '1') return NextResponse.json({ error: 'Missing accept confirmation' }, { status: 400 });

  const supabase = db();
  const { data: transfer } = await supabase
    .from('ticket_transfers')
    .select('*')
    .eq('reference', ref)
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (!transfer) return NextResponse.json({ error: 'Transfer not found, already used, or expired' }, { status: 404 });
  if (new Date(transfer.expires_at) < new Date()) return NextResponse.json({ error: 'Transfer link has expired' }, { status: 410 });

  // Execute the transfer atomically
  const { error } = await supabase
    .from('tickets')
    .update({ guest_email: transfer.to_email })
    .eq('reference', ref)
    .eq('guest_email', transfer.from_email)
    .eq('is_scanned', false);

  if (error) return NextResponse.json({ error: 'Transfer failed: ' + error.message }, { status: 500 });

  // Mark transfer complete
  await supabase.from('ticket_transfers').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('reference', ref);

  return NextResponse.json({ ok: true, message: 'Ticket successfully transferred! Check your dashboard.', event_title: transfer.event_title });
}
