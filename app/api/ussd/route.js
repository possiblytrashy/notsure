// OUSTED USSD Ticket Purchase — Arkesel USSD API
// Uses Supabase REST API directly via fetch() — no Supabase client imported.
//
// v2 changes:
//   - Paystack MoMo fee (1.95% + GHS 0.50) is now shown and charged to the buyer
//   - Fee breakdown shown in CONFIRM state: base / OUSTED fee / Paystack fee / total
//   - gross-up applied to pesewas so platform receives correct net amount

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';

const MOMO = {
  '1': { label: 'MTN MoMo',     code: 'mtn' },
  '2': { label: 'Telecel Cash', code: 'vod' },
  '3': { label: 'AirtelTigo',   code: 'atl' },
};

// ─── PAYSTACK FEE GROSS-UP ─────────────────────────────────────
// Ghana MoMo: 1.95% of total + GHS 0.50 fixed.
// Gross-up so after Paystack deducts their fee, platform receives desired_net in full.
function calcPaystackFee(desiredNetGHS) {
  const total = (desiredNetGHS + 0.50) / (1 - 0.0195);
  const fee   = total - desiredNetGHS;
  return {
    fee:   parseFloat(fee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

// ─── SUPABASE REST HELPERS ────────────────────────────────────
const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra) {
  return Object.assign({
    apikey:          SB_KEY(),
    Authorization:   'Bearer ' + SB_KEY(),
    'Content-Type':  'application/json',
  }, extra || {});
}

async function sbSelect(table, filters, single) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method:  'GET',
    headers: sbHeaders({ Accept: single ? 'application/vnd.pgrst.object+json' : 'application/json' }),
  });
  if (res.status === 406 || res.status === 404) return { data: null };
  const data = await res.json();
  return { data: data || null };
}

async function sbInsert(table, body) {
  const res = await fetch(SB_URL() + '/rest/v1/' + table, {
    method:  'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body:    JSON.stringify(body),
  });
  return { error: res.ok ? null : await res.text() };
}

async function sbUpdate(table, filters, body) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method:  'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body:    JSON.stringify(body),
  });
  return { error: res.ok ? null : await res.text() };
}

async function sbDelete(table, filters) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method:  'DELETE',
    headers: sbHeaders(),
  });
  return { error: res.ok ? null : await res.text() };
}

// ─── ENTRY POINT ─────────────────────────────────────────────
export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ message: 'Invalid request', continueSession: false }, { status: 400 }); }

  console.log('[USSD] body:', JSON.stringify(body));

  const { sessionID, userID, newSession, msisdn, userData = '', network = '' } = body;
  if (!sessionID || !msisdn) {
    return NextResponse.json({ message: 'Bad request', continueSession: false }, { status: 400 });
  }

  const input = String(userData).trim();

  if (newSession === true || newSession === 'true') {
    await sbDelete('ussd_sessions', { session_id: 'eq.' + sessionID });
    await sbInsert('ussd_sessions', { session_id: sessionID, msisdn, network, state: 'MAIN_MENU', data: {} });
    return respond(sessionID, userID, msisdn, mainMenu(), true);
  }

  const sessResult = await sbSelect('ussd_sessions', { session_id: 'eq.' + sessionID, select: '*' }, true);
  const sess = sessResult.data;
  if (!sess) {
    return respond(sessionID, userID, msisdn, 'Session expired.\n' + mainMenu(), true);
  }

  const session = { state: sess.state, data: sess.data || {} };
  const { nextState, nextData, message, end } = await transition(session, input, msisdn);

  if (end || nextState === 'END') {
    await sbDelete('ussd_sessions', { session_id: 'eq.' + sessionID });
    return respond(sessionID, userID, msisdn, message, false);
  }

  await sbUpdate('ussd_sessions', { session_id: 'eq.' + sessionID }, {
    state:      nextState,
    data:       nextData,
    updated_at: new Date().toISOString(),
  });

  return respond(sessionID, userID, msisdn, message, true);
}

function respond(sessionID, userID, msisdn, message, continueSession) {
  return NextResponse.json({ sessionID, userID, msisdn, message, continueSession });
}

function mainMenu(prefix) {
  return (prefix || '') + 'OUSTED - Event Tickets\n1. Buy Tickets\n2. My Tickets\n0. Exit';
}

// ─── STATE MACHINE ────────────────────────────────────────────
async function transition(session, input, msisdn) {
  const state = session.state;
  const data  = session.data;

  if (state === 'MAIN_MENU') {
    if (input === '1') return { nextState: 'BROWSE_EVENTS', nextData: data, message: await buildEventsMenu() };
    if (input === '2') return { nextState: 'MAIN_MENU', nextData: data, message: await myTicketsMenu(msisdn) };
    if (input === '0') return { end: true, message: 'Thank you for using OUSTED.' };
    return { nextState: 'MAIN_MENU', nextData: data, message: mainMenu('Invalid option.\n') };
  }

  if (state === 'BROWSE_EVENTS') {
    if (input === '0') return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu() };
    const events = await getEvents();
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= events.length) {
      return { nextState: 'BROWSE_EVENTS', nextData: data, message: await buildEventsMenu('Invalid choice.\n') };
    }
    const ev = events[idx];
    return {
      nextState: 'SELECT_TIER',
      nextData:  { event_id: ev.id, event_title: ev.title },
      message:   await buildTiersMenu(ev),
    };
  }

  if (state === 'SELECT_TIER') {
    if (input === '0') return { nextState: 'BROWSE_EVENTS', nextData: {}, message: await buildEventsMenu() };
    const tiers = await getTiers(data.event_id);
    const idx   = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= tiers.length) {
      return { nextState: 'SELECT_TIER', nextData: data, message: await buildTiersMenu({ id: data.event_id, title: data.event_title }, 'Invalid choice.\n') };
    }
    const tier            = tiers[idx];
    const ousted_fee      = parseFloat((tier.price * 0.05).toFixed(2));
    const sub_total       = parseFloat((tier.price + ousted_fee).toFixed(2));
    const { fee: ps_fee, total } = calcPaystackFee(sub_total);
    return {
      nextState: 'SELECT_QTY',
      nextData: {
        event_id:        data.event_id,
        event_title:     data.event_title,
        tier_id:         tier.id,
        tier_name:       tier.name,
        base_price:      tier.price,
        ousted_fee,
        paystack_fee:    ps_fee,
        total_per_ticket: total,
      },
      message: data.event_title + '\n' +
               tier.name + ': GHS ' + tier.price.toFixed(2) + '\n' +
               'OUSTED fee: GHS ' + ousted_fee.toFixed(2) + '\n' +
               'Processing: GHS ' + ps_fee.toFixed(2) + '\n' +
               'Total/ticket: GHS ' + total.toFixed(2) + '\n\n' +
               'Enter quantity (1-5):\n0. Back',
    };
  }

  if (state === 'SELECT_QTY') {
    if (input === '0') {
      return { nextState: 'SELECT_TIER', nextData: { event_id: data.event_id, event_title: data.event_title }, message: await buildTiersMenu({ id: data.event_id, title: data.event_title }) };
    }
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 1 || qty > 5) {
      return { nextState: 'SELECT_QTY', nextData: data, message: 'Enter quantity (1-5):\n0. Back' };
    }
    // Recalculate Paystack fee on the full transaction total (fee charged once per transaction)
    const sub_total_txn  = parseFloat((data.base_price + data.ousted_fee).toFixed(2)) * qty;
    const { fee: ps_fee_total, total: txn_total } = calcPaystackFee(sub_total_txn);
    const total_amount   = parseFloat(txn_total.toFixed(2));
    return {
      nextState: 'SELECT_NETWORK',
      nextData:  { ...data, quantity: qty, total_amount, paystack_fee_total: ps_fee_total },
      message: 'Order: ' + qty + 'x ' + data.tier_name + '\n' +
               'Sub-total: GHS ' + sub_total_txn.toFixed(2) + '\n' +
               'Processing: GHS ' + ps_fee_total.toFixed(2) + '\n' +
               'TOTAL: GHS ' + total_amount.toFixed(2) + '\n\n' +
               'Pay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back',
    };
  }

  if (state === 'SELECT_NETWORK') {
    if (input === '0') {
      return {
        nextState: 'SELECT_QTY',
        nextData:  data,
        message:   data.event_title + '\n' + data.tier_name + ': GHS ' + data.base_price.toFixed(2) + '\n\nEnter quantity (1-5):\n0. Back',
      };
    }
    if (!MOMO[input]) return { nextState: 'SELECT_NETWORK', nextData: data, message: 'Choose network:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back' };
    const net = MOMO[input];
    return {
      nextState: 'ENTER_PHONE',
      nextData:  { ...data, momo_code: net.code, momo_label: net.label },
      message:   net.label + ' selected.\n\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back',
    };
  }

  if (state === 'ENTER_PHONE') {
    if (input === '0') return { nextState: 'SELECT_NETWORK', nextData: data, message: 'Pay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back' };
    const phone = normalisePhone(input);
    if (!phone) return { nextState: 'ENTER_PHONE', nextData: data, message: 'Invalid number.\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back' };
    return {
      nextState: 'CONFIRM',
      nextData:  { ...data, momo_phone: phone },
      message: 'Confirm order:\n' +
               data.event_title + '\n' +
               data.tier_name + ' x' + data.quantity + '\n' +
               'Total: GHS ' + data.total_amount.toFixed(2) + '\n' +
               'From: ' + phone + ' (' + data.momo_label + ')\n\n' +
               'Incl. GHS ' + data.paystack_fee_total.toFixed(2) + ' processing fee\n\n' +
               '1. Confirm\n2. Cancel',
    };
  }

  if (state === 'CONFIRM') {
    if (input === '2' || input === '0') return { end: true, message: 'Order cancelled.\nThank you for using OUSTED.' };
    if (input !== '1') return { nextState: 'CONFIRM', nextData: data, message: 'Press 1 to confirm or 2 to cancel.' };
    const msisdn_norm = normalisePhone(data.momo_phone) || data.momo_phone;
    const result = await initiatePayment(data, msisdn_norm);
    if (!result.success) {
      return { end: true, message: 'Payment failed:\n' + (result.error || 'Unknown error') + '\n\nPlease try again.' };
    }
    const paymentStatus = result.paymentStatus;
    if (paymentStatus === 'pay_offline' || paymentStatus === 'pending') {
      return {
        nextState: 'WAITING',
        nextData:  { ...data, reference: result.reference },
        message: 'Payment request sent!\nCheck your ' + data.momo_label + ' phone for a prompt and enter your PIN to complete.\n\nYour ticket will be sent by SMS once confirmed.',
      };
    }
    if (paymentStatus === 'send_otp') {
      return {
        nextState: 'ENTER_OTP',
        nextData:  { ...data, reference: result.reference },
        message:   'Enter the OTP sent to your phone:\n0. Cancel',
      };
    }
    if (paymentStatus === 'success') {
      return { end: true, message: 'Payment confirmed!\nYour ticket will arrive by SMS shortly.\n\nRef: ' + result.reference };
    }
    return {
      nextState: 'WAITING',
      nextData:  { ...data, reference: result.reference },
      message:   'Payment initiated!\nComplete any prompt on your ' + data.momo_label + ' phone.\n\nYour ticket will be sent by SMS once confirmed.',
    };
  }

  if (state === 'ENTER_OTP') {
    if (input === '0') return { end: true, message: 'Payment cancelled.' };
    if (!input || input.length < 4) return { nextState: 'ENTER_OTP', nextData: data, message: 'Invalid OTP.\nEnter the OTP sent to your phone:\n0. Cancel' };
    const otpResult = await submitOTP(input, data.reference);
    if (!otpResult.success) return { nextState: 'ENTER_OTP', nextData: data, message: 'Invalid OTP.\nEnter the OTP sent to your phone:\n0. Cancel' };
    return { end: true, message: 'Payment confirmed!\nYour ticket will arrive by SMS shortly.\n\nRef: ' + data.reference };
  }

  if (state === 'WAITING') {
    return { end: true, message: 'Your payment is being processed.\nYou will receive your ticket by SMS once confirmed.\n\nRef: ' + (data.reference || 'pending') };
  }

  return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu() };
}

// ─── PAYSTACK CHARGE (MoMo) ──────────────────────────────────
async function initiatePayment(data, msisdn) {
  const reference    = 'USSD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  // data.total_amount is already the grossed-up total (customer pays Paystack fee)
  const pesewas      = Math.round(data.total_amount * 100);
  const guestEmail   = 'ussd-' + data.momo_phone + '@ousted.live';
  const paystackPhone = data.momo_phone.startsWith('233') ? '0' + data.momo_phone.slice(3) : data.momo_phone;

  try {
    const res = await fetch('https://api.paystack.co/charge', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:        guestEmail,
        amount:       pesewas,
        currency:     'GHS',
        mobile_money: { phone: paystackPhone, provider: data.momo_code },
        reference,
        metadata: {
          type:                 'TICKET',
          channel:              'USSD',
          event_id:             data.event_id,
          tier_id:              data.tier_id,
          tier_name:            data.tier_name,
          event_title:          data.event_title,
          quantity:             data.quantity,
          base_price:           data.base_price,
          platform_fee:         data.ousted_fee,
          paystack_fee:         data.paystack_fee_total,
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
    console.log('[USSD] Paystack charge response:', JSON.stringify(ps));

    if (!ps.status) return { success: false, error: ps.message || 'Payment service unavailable.' };

    const paymentStatus = ps.data?.status;
    if (paymentStatus === 'failed') return { success: false, error: (ps.data?.message || ps.message || 'Charge was rejected.') };

    // Store pending record
    await sbInsert('ussd_pending', {
      reference,
      msisdn:        data.momo_phone,
      event_id:      data.event_id,
      tier_id:       data.tier_id,
      tier_name:     data.tier_name,
      event_title:   data.event_title,
      quantity:      data.quantity,
      base_price:    data.base_price,
      total_amount:  data.total_amount,
      momo_phone:    data.momo_phone,
      momo_network:  data.momo_code,
      status:        'pending',
    });

    return { success: true, reference, paymentStatus };
  } catch (err) {
    console.error('[USSD] Payment error:', err.message);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

async function submitOTP(otp, reference) {
  try {
    const res = await fetch('https://api.paystack.co/charge/submit_otp', {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ otp, reference }),
    });
    const ps = await res.json();
    if (ps.status && ps.data?.status !== 'failed') return { success: true };
    return { success: false };
  } catch {
    return { success: false };
  }
}

// ─── DATA HELPERS ─────────────────────────────────────────────
async function getEvents() {
  const today  = new Date().toISOString().split('T')[0];
  const result = await sbSelect('events', {
    select:     'id,title,date,location',
    status:     'eq.active',
    is_deleted: 'neq.true',
    date:       'gte.' + today,
    order:      'date.asc',
    limit:      '8',
  });
  return result.data || [];
}

async function buildEventsMenu(prefix) {
  const events = await getEvents();
  if (!events.length) return 'No upcoming events.\n0. Back';
  const lines = events.map((e, i) => {
    const dateStr = e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    const title   = e.title.length > 18 ? e.title.substring(0, 17) + '.' : e.title;
    return (i + 1) + '. ' + title + (dateStr ? ' ' + dateStr : '');
  }).join('\n');
  return (prefix || '') + 'Upcoming Events:\n' + lines + '\n0. Back';
}

async function getTiers(event_id) {
  const result = await sbSelect('ticket_tiers', {
    select:   'id,name,price,max_quantity',
    event_id: 'eq.' + event_id,
    order:    'price.asc',
  });
  return result.data || [];
}

async function buildTiersMenu(event, prefix) {
  const tiers = await getTiers(event.id);
  if (!tiers.length) return 'No tickets available.\n0. Back';
  const title = event.title.length > 20 ? event.title.substring(0, 19) + '.' : event.title;
  const lines = tiers.map((t, i) => (i + 1) + '. ' + t.name + ' - GHS ' + t.price.toFixed(2)).join('\n');
  return (prefix || '') + title + '\nSelect tier:\n' + lines + '\n0. Back';
}

async function myTicketsMenu(msisdn) {
  const phone      = normalisePhone(msisdn) || msisdn;
  const guestEmail = 'ussd-' + phone + '@ousted.live';
  const result     = await sbSelect('tickets', {
    select:      'ticket_number,tier_name,guest_phone',
    guest_phone: 'eq.' + phone,   // now uses the guest_phone column directly
    status:      'eq.valid',
    order:       'created_at.desc',
    limit:       '3',
  });
  // Fallback to email-based lookup for pre-migration rows
  const data = result.data?.length
    ? result.data
    : (await sbSelect('tickets', { select: 'ticket_number,tier_name', guest_email: 'eq.' + guestEmail, status: 'eq.valid', order: 'created_at.desc', limit: '3' })).data;

  if (!data?.length) return 'No tickets found for\n' + phone + '\n\nBuy tickets: option 1\n0. Back to menu';
  const lines = data.map((t, i) => (i + 1) + '. #' + t.ticket_number + ' (' + (t.tier_name || 'GA') + ')').join('\n');
  return 'Your Tickets:\n' + lines + '\n\nousted.live/tickets/find\n0. Back';
}

// ─── UTILITY ──────────────────────────────────────────────────
function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     return '233' + p.slice(1);
  if (/^\+233[2-9]\d{8}$/.test(p)) return p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))   return p;
  return null;
}
