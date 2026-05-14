// OUSTED USSD Ticket Purchase System
// Handles three API formats:
//   - Wigal Smart USSD V1 (GET + pipe-delimited response)
//   - Wigal Smart USSD V2 (POST + JSON response)
//   - Frog USSD (POST + JSON with newSession/continueSession)
//
// Full flow: Browse events → Pick tier → Quantity → MoMo payment → SMS ticket link
// All payments go to platform account. Organizer owed amounts tracked in payout_ledger.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

// ─── CONSTANTS ───────────────────────────────────────────────
const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

// MoMo network codes for Paystack
const MOMO_NETWORKS = {
  '1': { label: 'MTN MoMo',       code: 'mtn',  provider: 'MTN' },
  '2': { label: 'Telecel Cash',   code: 'vod',  provider: 'Telecel' },
  '3': { label: 'AirtelTigo',     code: 'atl',  provider: 'AirtelTigo' },
};

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── ENTRY POINTS ────────────────────────────────────────────

// Wigal V1 — GET request, pipe-delimited response
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const params = {
    network:   searchParams.get('network')   || '',
    sessionid: searchParams.get('sessionid') || '',
    mode:      (searchParams.get('mode') || 'start').toUpperCase(),
    msisdn:    searchParams.get('msisdn')    || '',
    userdata:  searchParams.get('userdata')  || '',
    username:  searchParams.get('username')  || '',
    trafficid: searchParams.get('trafficid') || '',
    other:     searchParams.get('other')     || '',
  };

  const { responseMode, menuText, other } = await handleUSSD(params);

  // V1 pipe-delimited response
  // NETWORK|MODE|MSISDN|SESSIONID|USERDATA|USERNAME|TRAFFICID|OTHER
  const response = [
    params.network,
    responseMode,
    params.msisdn,
    params.sessionid,
    menuText,
    params.username,
    params.trafficid,
    other || params.other,
  ].join('|');

  return new Response(response, { headers: { 'Content-Type': 'text/plain' } });
}

// Wigal V2 + Frog — POST request, JSON response
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Detect format: Frog uses newSession, Wigal V2 uses mode
  const isFrog = 'newSession' in body || 'continueSession' in body;

  let params;
  if (isFrog) {
    params = {
      network:   body.network   || 'frog',
      sessionid: body.sessionId || body.sessionid || '',
      mode:      body.newSession ? 'START' : 'MORE',
      msisdn:    body.msisdn    || body.phoneNumber || body.phonenumber || '',
      userdata:  body.userData  || body.userdata    || '',
      username:  body.username  || 'ousted',
      trafficid: body.trafficId || body.trafficid   || '',
      other:     body.other     || '',
    };
  } else {
    // Wigal V2
    params = {
      network:   body.network      || '',
      sessionid: body.sessionid    || '',
      mode:      (body.mode || 'start').toUpperCase(),
      msisdn:    body.phonenumber  || body.msisdn || '',
      userdata:  body.userdata     || '',
      username:  body.username     || '',
      trafficid: body.trafficid    || '',
      other:     body.other        || '',
    };
  }

  const { responseMode, menuText, other } = await handleUSSD(params);
  const isEnd = responseMode === 'END';

  if (isFrog) {
    // Frog format response
    return NextResponse.json({
      ...body,
      userData: menuText,
      continueSession: !isEnd,
    });
  }

  // Wigal V2 JSON response — return same object with updated mode and userdata
  return NextResponse.json({
    network:    params.network,
    sessionid:  params.sessionid,
    mode:       responseMode,
    phonenumber: params.msisdn,
    userdata:   menuText,
    username:   params.username,
    trafficid:  params.trafficid,
    other:      other || params.other,
  });
}

// ─── CORE SESSION HANDLER ────────────────────────────────────
async function handleUSSD({ network, sessionid, mode, msisdn, userdata, username, trafficid, other }) {
  const db = getDb();

  // Load or create session
  let session = null;
  if (mode === 'START') {
    // Delete any existing session (user re-dialled)
    await db.from('ussd_sessions').delete().eq('session_id', sessionid).catch(() => {});
    await db.from('ussd_sessions').insert({
      session_id: sessionid,
      msisdn,
      network,
      state: 'MAIN_MENU',
      data: {},
    }).catch(() => {});
    return buildMenu('MAIN_MENU', {});
  }

  // Load existing session
  const { data: sess } = await db
    .from('ussd_sessions')
    .select('*')
    .eq('session_id', sessionid)
    .maybeSingle();

  if (!sess) {
    // Session expired — restart
    await db.from('ussd_sessions').insert({
      session_id: sessionid, msisdn, network,
      state: 'MAIN_MENU', data: {},
    }).catch(() => {});
    return buildMenu('MAIN_MENU', {});
  }

  session = { ...sess, data: sess.data || {} };
  const input = (userdata || '').trim();

  // State machine
  const { nextState, nextData, response } = await transition(session, input, msisdn, db);

  if (nextState === 'END') {
    await db.from('ussd_sessions').delete().eq('session_id', sessionid).catch(() => {});
    return { responseMode: 'END', menuText: response };
  }

  // Update session state
  await db.from('ussd_sessions')
    .update({ state: nextState, data: nextData, updated_at: new Date().toISOString() })
    .eq('session_id', sessionid)
    .catch(() => {});

  return { responseMode: 'MORE', menuText: response };
}

// ─── STATE MACHINE ────────────────────────────────────────────
async function transition(session, input, msisdn, db) {
  const { state, data } = session;

  switch (state) {

    case 'MAIN_MENU': {
      if (input === '1') return { nextState: 'BROWSE_EVENTS', nextData: data, response: await getBrowseMenu(db) };
      if (input === '2') return { nextState: 'MY_TICKETS', nextData: data, response: await getMyTickets(msisdn, db) };
      if (input === '0') return { nextState: 'END', nextData: {}, response: 'Thank you for using OUSTED. Goodbye!' };
      return { nextState: 'MAIN_MENU', nextData: data, response: mainMenu('Invalid option. ' ) };
    }

    case 'BROWSE_EVENTS': {
      if (input === '0') return { nextState: 'MAIN_MENU', nextData: {}, response: mainMenu() };
      // input is event number
      const events = await getUpcomingEvents(db);
      const idx = parseInt(input, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= events.length) {
        return { nextState: 'BROWSE_EVENTS', nextData: data, response: await getBrowseMenu(db, 'Invalid choice. ') };
      }
      const event = events[idx];
      const tiersMenu = await getEventTiersMenu(event, db);
      return { nextState: 'SELECT_TIER', nextData: { event_id: event.id, event_title: event.title }, response: tiersMenu };
    }

    case 'SELECT_TIER': {
      if (input === '0') return { nextState: 'BROWSE_EVENTS', nextData: {}, response: await getBrowseMenu(db) };
      const tiers = await getEventTiers(data.event_id, db);
      const idx = parseInt(input, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= tiers.length) {
        return { nextState: 'SELECT_TIER', nextData: data, response: await getEventTiersMenu({ id: data.event_id, title: data.event_title }, db, 'Invalid choice. ') };
      }
      const tier = tiers[idx];
      const fee = (tier.price * 0.05);
      const total = tier.price + fee;
      return {
        nextState: 'SELECT_QTY',
        nextData: { ...data, tier_id: tier.id, tier_name: tier.name, base_price: tier.price, fee, total_per_ticket: total },
        response: `${data.event_title}^${tier.name}: GHS ${tier.price.toFixed(2)}^Platform fee: GHS ${fee.toFixed(2)}^Total/ticket: GHS ${total.toFixed(2)}^^Enter quantity (1-5):^0.Back`,
      };
    }

    case 'SELECT_QTY': {
      if (input === '0') {
        const tiersMenu = await getEventTiersMenu({ id: data.event_id, title: data.event_title }, db);
        return { nextState: 'SELECT_TIER', nextData: { event_id: data.event_id, event_title: data.event_title }, response: tiersMenu };
      }
      const qty = parseInt(input, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return { nextState: 'SELECT_QTY', nextData: data, response: `Enter quantity (1-5):^0.Back` };
      }
      const totalAmt = data.total_per_ticket * qty;
      return {
        nextState: 'SELECT_NETWORK',
        nextData: { ...data, quantity: qty, total_amount: totalAmt },
        response: `Total: GHS ${totalAmt.toFixed(2)} for ${qty} ticket(s)^^Select payment:^1.MTN MoMo^2.Telecel Cash^3.AirtelTigo^0.Back`,
      };
    }

    case 'SELECT_NETWORK': {
      if (input === '0') {
        const fee = data.base_price * 0.05;
        const total = data.base_price + fee;
        return { nextState: 'SELECT_QTY', nextData: { ...data, fee, total_per_ticket: total }, response: `${data.event_title}^${data.tier_name}: GHS ${data.base_price.toFixed(2)}^^Enter quantity (1-5):^0.Back` };
      }
      if (!MOMO_NETWORKS[input]) {
        return { nextState: 'SELECT_NETWORK', nextData: data, response: `Select payment:^1.MTN MoMo^2.Telecel Cash^3.AirtelTigo^0.Back` };
      }
      const net = MOMO_NETWORKS[input];
      // Pre-fill phone number from MSISDN if same network
      return {
        nextState: 'ENTER_PHONE',
        nextData: { ...data, momo_network: net.code, momo_provider: net.label },
        response: `${net.label} selected^^Enter MoMo number:^(e.g. 0241234567)^0.Back`,
      };
    }

    case 'ENTER_PHONE': {
      if (input === '0') {
        return { nextState: 'SELECT_NETWORK', nextData: data, response: `Select payment:^1.MTN MoMo^2.Telecel Cash^3.AirtelTigo^0.Back` };
      }
      // Normalise phone number to 233XXXXXXXXX
      const phone = normalisePhone(input);
      if (!phone) {
        return { nextState: 'ENTER_PHONE', nextData: data, response: `Invalid number.^Enter MoMo number:^(e.g. 0241234567)^0.Back` };
      }
      return {
        nextState: 'CONFIRM_PAYMENT',
        nextData: { ...data, momo_phone: phone },
        response: `Confirm order:^${data.event_title}^${data.tier_name} x${data.quantity}^Pay: GHS ${data.total_amount.toFixed(2)}^From: ${phone}^(${data.momo_provider})^^1.Confirm^2.Cancel`,
      };
    }

    case 'CONFIRM_PAYMENT': {
      if (input === '2' || input === '0') {
        return { nextState: 'MAIN_MENU', nextData: {}, response: mainMenu('Order cancelled. ') };
      }
      if (input !== '1') {
        return { nextState: 'CONFIRM_PAYMENT', nextData: data, response: `1.Confirm payment^2.Cancel` };
      }
      // Initiate payment
      const payResult = await initiateUSSDPayment(data, msisdn, db);
      if (payResult.success) {
        return {
          nextState: 'END',
          nextData: {},
          response: `Payment initiated!^Check your phone for MoMo prompt.^^Approve the GHS ${data.total_amount.toFixed(2)} payment to receive your ticket(s) by SMS.`,
        };
      }
      return {
        nextState: 'END',
        nextData: {},
        response: `Payment failed.^${payResult.error || 'Please try again.'}^Dial again to retry.`,
      };
    }

    case 'MY_TICKETS': {
      if (input === '0') return { nextState: 'MAIN_MENU', nextData: {}, response: mainMenu() };
      return { nextState: 'MAIN_MENU', nextData: {}, response: mainMenu() };
    }

    default:
      return { nextState: 'MAIN_MENU', nextData: {}, response: mainMenu() };
  }
}

// ─── MENU BUILDERS ────────────────────────────────────────────
function mainMenu(prefix = '') {
  return `${prefix}Welcome to OUSTED^Ghana Event Tickets^^1.Buy Tickets^2.My Tickets^0.Exit`;
}

function buildMenu(state) {
  if (state === 'MAIN_MENU') return { responseMode: 'MORE', menuText: mainMenu() };
  return { responseMode: 'MORE', menuText: mainMenu() };
}

async function getUpcomingEvents(db) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await db
    .from('events')
    .select('id,title,date,location')
    .eq('status', 'active')
    .eq('is_deleted', false)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(8);
  return data || [];
}

async function getBrowseMenu(db, prefix = '') {
  const events = await getUpcomingEvents(db);
  if (!events.length) return `No upcoming events.^^0.Back`;
  const lines = events.map((e, i) => {
    const date = e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    // Truncate title to fit 160 char limit across all lines
    const title = e.title.length > 20 ? e.title.substring(0, 18) + '..' : e.title;
    return `${i + 1}.${title}${date ? ' ' + date : ''}`;
  }).join('^');
  return `${prefix}Upcoming Events:^${lines}^0.Back`;
}

async function getEventTiers(event_id, db) {
  const { data } = await db
    .from('ticket_tiers')
    .select('id,name,price,max_quantity')
    .eq('event_id', event_id)
    .order('price', { ascending: true });
  return data || [];
}

async function getEventTiersMenu(event, db, prefix = '') {
  const tiers = await getEventTiers(event.id, db);
  if (!tiers.length) return `No tickets available.^0.Back`;
  const title = event.title.length > 22 ? event.title.substring(0, 20) + '..' : event.title;
  const lines = tiers.map((t, i) => `${i + 1}.${t.name} GHS${t.price.toFixed(0)}`).join('^');
  return `${prefix}${title}^Select ticket tier:^${lines}^0.Back`;
}

async function getMyTickets(msisdn, db) {
  const normalised = normalisePhone(msisdn);
  const phone = normalised || msisdn;
  // Find tickets by phone — try both number formats
  const { data: tickets } = await db
    .from('tickets')
    .select('ticket_number,tier_name,events!event_id(title,date)')
    .or(`guest_email.ilike.${phone}%`)
    .eq('status', 'valid')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!tickets?.length) return `No tickets found.^Buy tickets: option 1^0.Back`;
  const lines = tickets.map((t, i) => {
    const ev = t.events?.title?.substring(0, 15) || 'Event';
    return `${i + 1}.${ev} (${t.tier_name || 'GA'})`;
  }).join('^');
  return `Your Tickets:^${lines}^^Visit ousted.live for^full ticket details^0.Back`;
}

// ─── PAYMENT ─────────────────────────────────────────────────
async function initiateUSSDPayment(data, msisdn, db) {
  const reference = `USSD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const amountPesewas = Math.round(data.total_amount * 100);

  try {
    // Initiate Paystack mobile money charge
    const res = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: PLATFORM_EMAIL,
        amount: amountPesewas,
        currency: 'GHS',
        mobile_money: {
          phone: data.momo_phone,
          provider: data.momo_network,  // mtn | vod | atl
        },
        reference,
        metadata: {
          type: 'TICKET',
          channel: 'USSD',
          event_id: data.event_id,
          tier_id: data.tier_id,
          tier_name: data.tier_name,
          event_title: data.event_title,
          quantity: data.quantity,
          base_price: data.base_price,
          platform_fee: data.fee,
          buyer_price: data.total_per_ticket,
          organizer_owes: parseFloat((data.base_price * data.quantity).toFixed(2)),
          reseller_owes: 0,
          // USSD buyer — no account, identify by phone
          guest_email: `ussd-${data.momo_phone}@ousted.live`,
          guest_name: `USSD Buyer`,
          ussd_phone: data.momo_phone,
          momo_provider: data.momo_provider,
          reseller_code: 'DIRECT',
          is_reseller_purchase: false,
        },
      }),
    });

    const psData = await res.json();

    if (!psData.status) {
      console.error('[USSD] Paystack charge failed:', psData.message);
      return { success: false, error: psData.message || 'Payment failed' };
    }

    // Store pending USSD purchase so webhook can create tickets + send SMS
    await db.from('ussd_pending').insert({
      reference,
      msisdn: data.momo_phone,
      event_id: data.event_id,
      tier_id: data.tier_id,
      tier_name: data.tier_name,
      event_title: data.event_title,
      quantity: data.quantity,
      base_price: data.base_price,
      total_amount: data.total_amount,
      momo_phone: data.momo_phone,
      momo_network: data.momo_network,
      status: 'pending',
    }).catch(() => {});

    return { success: true, reference };
  } catch (err) {
    console.error('[USSD] Payment error:', err.message);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
function normalisePhone(input) {
  if (!input) return null;
  // Remove spaces, dashes, brackets
  let p = input.replace(/[\s\-()]/g, '');
  // 0XXXXXXXXX → 233XXXXXXXXX
  if (/^0[2-9]\d{8}$/.test(p)) p = '233' + p.slice(1);
  // +233XXXXXXXXX → 233XXXXXXXXX
  if (/^\+233\d{9}$/.test(p)) p = p.slice(1);
  // Validate Ghana number
  if (/^233[2-9]\d{8}$/.test(p)) return p;
  return null;
}
