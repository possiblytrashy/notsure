// OUSTED USSD Ticket Purchase — Arkesel USSD API
//
// Arkesel sends POST requests to this endpoint.
// We respond with JSON: { sessionID, userID, msisdn, message, continueSession }
// continueSession: true  = show menu and wait for input
// continueSession: false = display final message and close session
//
// Full purchase flow:
//   Main Menu → Browse Events → Pick Tier → Quantity → MoMo Network → Phone → Confirm
//   → Paystack MoMo charge → webhook → tickets created → Arkesel SMS sent
//
// ALL money lands in your Paystack account.
// payout_ledger tracks what you owe each organizer.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';
const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

const MOMO = {
  '1': { label: 'MTN MoMo',     code: 'mtn' },
  '2': { label: 'Telecel Cash', code: 'vod' },
  '3': { label: 'AirtelTigo',   code: 'atl' },
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── ENTRY POINT ─────────────────────────────────────────────
export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid request', continueSession: false }, { status: 400 }); }

  // Arkesel request shape:
  // { sessionID, userID, newSession, msisdn, userData, network }
  const {
    sessionID,
    userID,
    newSession,
    msisdn,
    userData = '',
    network  = '',
  } = body;

  if (!sessionID || !msisdn) {
    return NextResponse.json({ message: 'Bad request', continueSession: false }, { status: 400 });
  }

  const supabase = db();
  const input    = String(userData).trim();

  // ── NEW SESSION: reset state ──────────────────────────────
  if (newSession === true) {
    await supabase.from('ussd_sessions').delete().eq('session_id', sessionID).catch(() => {});
    await supabase.from('ussd_sessions').insert({
      session_id: sessionID,
      msisdn,
      network,
      state: 'MAIN_MENU',
      data: {},
    }).catch(() => {});
    return respond(sessionID, userID, msisdn, mainMenu(), true);
  }

  // ── RESUME SESSION ────────────────────────────────────────
  const { data: sess } = await supabase
    .from('ussd_sessions')
    .select('*')
    .eq('session_id', sessionID)
    .maybeSingle();

  if (!sess) {
    // Session expired — restart gracefully
    return respond(sessionID, userID, msisdn,
      'Session expired.\n' + mainMenu(), true);
  }

  const session = { ...sess, data: sess.data || {} };

  // Run state machine
  const { nextState, nextData, message, end } =
    await transition(session, input, msisdn, supabase);

  if (end || nextState === 'END') {
    await supabase.from('ussd_sessions').delete().eq('session_id', sessionID).catch(() => {});
    return respond(sessionID, userID, msisdn, message, false);
  }

  await supabase.from('ussd_sessions')
    .update({ state: nextState, data: nextData, updated_at: new Date().toISOString() })
    .eq('session_id', sessionID)
    .catch(() => {});

  return respond(sessionID, userID, msisdn, message, true);
}

// ─── RESPONSE BUILDER ────────────────────────────────────────
function respond(sessionID, userID, msisdn, message, continueSession) {
  return NextResponse.json({ sessionID, userID, msisdn, message, continueSession });
}

// ─── MENUS ───────────────────────────────────────────────────
function mainMenu(prefix = '') {
  return `${prefix}OUSTED - Event Tickets\n1. Buy Tickets\n2. My Tickets\n0. Exit`;
}

// ─── STATE MACHINE ───────────────────────────────────────────
async function transition(session, input, msisdn, supabase) {
  const { state, data } = session;

  switch (state) {

    // ── MAIN MENU ─────────────────────────────────────────
    case 'MAIN_MENU': {
      if (input === '1') {
        const menu = await buildEventsMenu(supabase);
        return { nextState: 'BROWSE_EVENTS', nextData: data, message: menu };
      }
      if (input === '2') {
        const msg = await myTicketsMenu(msisdn, supabase);
        return { nextState: 'MAIN_MENU', nextData: data, message: msg };
      }
      if (input === '0') {
        return { end: true, message: 'Thank you for using OUSTED.' };
      }
      return { nextState: 'MAIN_MENU', nextData: data, message: mainMenu('Invalid option.\n') };
    }

    // ── BROWSE EVENTS ─────────────────────────────────────
    case 'BROWSE_EVENTS': {
      if (input === '0') {
        return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu() };
      }
      const events = await getEvents(supabase);
      const idx    = parseInt(input, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= events.length) {
        const menu = await buildEventsMenu(supabase, 'Invalid choice.\n');
        return { nextState: 'BROWSE_EVENTS', nextData: data, message: menu };
      }
      const ev      = events[idx];
      const tierMsg = await buildTiersMenu(ev, supabase);
      return {
        nextState: 'SELECT_TIER',
        nextData:  { event_id: ev.id, event_title: ev.title },
        message:   tierMsg,
      };
    }

    // ── SELECT TIER ───────────────────────────────────────
    case 'SELECT_TIER': {
      if (input === '0') {
        const menu = await buildEventsMenu(supabase);
        return { nextState: 'BROWSE_EVENTS', nextData: {}, message: menu };
      }
      const tiers = await getTiers(data.event_id, supabase);
      const idx   = parseInt(input, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= tiers.length) {
        const menu = await buildTiersMenu({ id: data.event_id, title: data.event_title }, supabase, 'Invalid choice.\n');
        return { nextState: 'SELECT_TIER', nextData: data, message: menu };
      }
      const tier  = tiers[idx];
      const fee   = parseFloat((tier.price * 0.05).toFixed(2));
      const total = parseFloat((tier.price + fee).toFixed(2));
      const msg   = `${data.event_title}\n${tier.name}: GHS ${tier.price.toFixed(2)}\nFee: GHS ${fee.toFixed(2)}\nTotal/ticket: GHS ${total.toFixed(2)}\n\nEnter quantity (1-5):\n0. Back`;
      return {
        nextState: 'SELECT_QTY',
        nextData:  { ...data, tier_id: tier.id, tier_name: tier.name, base_price: tier.price, fee, total_per_ticket: total },
        message:   msg,
      };
    }

    // ── SELECT QUANTITY ───────────────────────────────────
    case 'SELECT_QTY': {
      if (input === '0') {
        const menu = await buildTiersMenu({ id: data.event_id, title: data.event_title }, supabase);
        return { nextState: 'SELECT_TIER', nextData: { event_id: data.event_id, event_title: data.event_title }, message: menu };
      }
      const qty = parseInt(input, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return { nextState: 'SELECT_QTY', nextData: data, message: 'Enter quantity (1-5):\n0. Back' };
      }
      const totalAmt = parseFloat((data.total_per_ticket * qty).toFixed(2));
      return {
        nextState: 'SELECT_NETWORK',
        nextData:  { ...data, quantity: qty, total_amount: totalAmt },
        message:   `Total: GHS ${totalAmt.toFixed(2)} for ${qty} ticket(s)\n\nPay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back`,
      };
    }

    // ── SELECT MOMO NETWORK ───────────────────────────────
    case 'SELECT_NETWORK': {
      if (input === '0') {
        return {
          nextState: 'SELECT_QTY',
          nextData:  data,
          message:   `${data.event_title}\n${data.tier_name}: GHS ${data.base_price.toFixed(2)}\n\nEnter quantity (1-5):\n0. Back`,
        };
      }
      if (!MOMO[input]) {
        return { nextState: 'SELECT_NETWORK', nextData: data, message: 'Choose network:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back' };
      }
      const net = MOMO[input];
      return {
        nextState: 'ENTER_PHONE',
        nextData:  { ...data, momo_code: net.code, momo_label: net.label },
        message:   `${net.label} selected.\n\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back`,
      };
    }

    // ── ENTER PHONE ───────────────────────────────────────
    case 'ENTER_PHONE': {
      if (input === '0') {
        return {
          nextState: 'SELECT_NETWORK',
          nextData:  data,
          message:   `Pay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back`,
        };
      }
      const phone = normalisePhone(input);
      if (!phone) {
        return { nextState: 'ENTER_PHONE', nextData: data, message: 'Invalid number.\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back' };
      }
      const msg = `Confirm order:\n${data.event_title}\n${data.tier_name} x${data.quantity}\nGHS ${data.total_amount.toFixed(2)}\nFrom: ${phone}\n(${data.momo_label})\n\n1. Confirm\n2. Cancel`;
      return {
        nextState: 'CONFIRM',
        nextData:  { ...data, momo_phone: phone },
        message:   msg,
      };
    }

    // ── CONFIRM & PAY ─────────────────────────────────────
    case 'CONFIRM': {
      if (input === '2' || input === '0') {
        return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu('Order cancelled.\n') };
      }
      if (input !== '1') {
        return { nextState: 'CONFIRM', nextData: data, message: '1. Confirm\n2. Cancel' };
      }

      const result = await initiatePayment(data, msisdn, supabase);
      if (result.success) {
        return {
          end: true,
          message: `Payment initiated!\nApprove the GHS ${data.total_amount.toFixed(2)} ${data.momo_label} prompt on your phone.\n\nYour ticket will be sent by SMS once confirmed.`,
        };
      }
      return {
        end: true,
        message: `Payment failed.\n${result.error}\n\nDial again to retry.`,
      };
    }

    default:
      return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu() };
  }
}

// ─── DATA HELPERS ─────────────────────────────────────────────
async function getEvents(supabase) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('events')
    .select('id,title,date,location')
    .eq('status', 'active')
    .eq('is_deleted', false)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(8);
  return data || [];
}

async function buildEventsMenu(supabase, prefix = '') {
  const events = await getEvents(supabase);
  if (!events.length) return `No upcoming events.\n0. Back`;
  const lines = events.map((e, i) => {
    const dateStr = e.date
      ? new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : '';
    // Keep under 160 chars total — truncate long titles
    const title = e.title.length > 18 ? e.title.substring(0, 17) + '.' : e.title;
    return `${i + 1}. ${title}${dateStr ? ' ' + dateStr : ''}`;
  }).join('\n');
  return `${prefix}Upcoming Events:\n${lines}\n0. Back`;
}

async function getTiers(event_id, supabase) {
  const { data } = await supabase
    .from('ticket_tiers')
    .select('id,name,price,max_quantity')
    .eq('event_id', event_id)
    .order('price', { ascending: true });
  return data || [];
}

async function buildTiersMenu(event, supabase, prefix = '') {
  const tiers = await getTiers(event.id, supabase);
  if (!tiers.length) return `No tickets available.\n0. Back`;
  const title = event.title.length > 20 ? event.title.substring(0, 19) + '.' : event.title;
  const lines = tiers.map((t, i) => `${i + 1}. ${t.name} - GHS ${t.price.toFixed(2)}`).join('\n');
  return `${prefix}${title}\nSelect tier:\n${lines}\n0. Back`;
}

async function myTicketsMenu(msisdn, supabase) {
  const phone = normalisePhone(msisdn) || msisdn;
  const guestEmail = `ussd-${phone}@ousted.live`;
  const { data } = await supabase
    .from('tickets')
    .select('ticket_number,tier_name,events!event_id(title,date)')
    .eq('guest_email', guestEmail)
    .eq('status', 'valid')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!data?.length) {
    return `No tickets found for\n${phone}\n\nBuy tickets: option 1\n0. Back to menu`;
  }

  const lines = data.map((t, i) => {
    const title = (t.events?.title || 'Event').substring(0, 14);
    const tier  = (t.tier_name || 'GA').substring(0, 10);
    return `${i + 1}. ${title} (${tier})`;
  }).join('\n');

  return `Your Tickets:\n${lines}\n\nFull details:\nousted.live/tickets/find\n0. Back`;
}

// ─── PAYSTACK MOMO CHARGE ─────────────────────────────────────
async function initiatePayment(data, msisdn, supabase) {
  const reference    = `USSD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const pesewas      = Math.round(data.total_amount * 100);
  const guestEmail   = `ussd-${data.momo_phone}@ousted.live`;

  try {
    const res = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:        PLATFORM_EMAIL,     // all money to platform account
        amount:       pesewas,
        currency:     'GHS',
        mobile_money: {
          phone:    data.momo_phone,
          provider: data.momo_code,       // mtn | vod | atl
        },
        reference,
        metadata: {
          type:                 'TICKET',
          channel:              'USSD',   // flags webhook to use USSD handler
          event_id:             data.event_id,
          tier_id:              data.tier_id,
          tier_name:            data.tier_name,
          event_title:          data.event_title,
          quantity:             data.quantity,
          base_price:           data.base_price,
          platform_fee:         data.fee,
          buyer_price:          data.total_per_ticket,
          guest_email:          guestEmail,
          guest_name:           'USSD Buyer',
          ussd_phone:           data.momo_phone,
          momo_provider:        data.momo_label,
          organizer_owes:       parseFloat((data.base_price * data.quantity).toFixed(2)),
          reseller_owes:        0,
          reseller_code:        'DIRECT',
          is_reseller_purchase: false,
        },
      }),
    });

    const ps = await res.json();
    if (!ps.status) {
      console.error('[USSD] Paystack charge failed:', ps.message);
      return { success: false, error: ps.message || 'Payment service unavailable.' };
    }

    // Store pending purchase so webhook can create tickets + send SMS
    await supabase.from('ussd_pending').insert({
      reference,
      msisdn:       data.momo_phone,
      event_id:     data.event_id,
      tier_id:      data.tier_id,
      tier_name:    data.tier_name,
      event_title:  data.event_title,
      quantity:     data.quantity,
      base_price:   data.base_price,
      total_amount: data.total_amount,
      momo_phone:   data.momo_phone,
      momo_network: data.momo_code,
      status:       'pending',
    }).catch(() => {});

    return { success: true, reference };

  } catch (err) {
    console.error('[USSD] Payment error:', err.message);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// ─── UTILITY ──────────────────────────────────────────────────
function normalisePhone(input) {
  if (!input) return null;
  let p = String(input).replace(/[\s\-()]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))    p = '233' + p.slice(1);   // 0XX → 233XX
  if (/^\+233[2-9]\d{8}$/.test(p)) p = p.slice(1);           // +233 → 233
  return /^233[2-9]\d{8}$/.test(p) ? p : null;
}
