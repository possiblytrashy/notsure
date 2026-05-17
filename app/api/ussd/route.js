// OUSTED USSD Ticket Purchase — Arkesel USSD API
// Uses Supabase REST API directly via fetch() — no Supabase client imported.
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';

const MOMO = {
  '1': { label: 'MTN MoMo',     code: 'mtn' },
  '2': { label: 'Telecel Cash', code: 'vod' },
  '3': { label: 'AirtelTigo',   code: 'atl' },
};

// ─── Supabase REST helpers (pure fetch, no client) ────────────
const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra) {
  return Object.assign({
    'apikey': SB_KEY(),
    'Authorization': 'Bearer ' + SB_KEY(),
    'Content-Type': 'application/json',
  }, extra || {});
}

async function sbSelect(table, filters, single) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method: 'GET',
    headers: sbHeaders({ 'Accept': single ? 'application/vnd.pgrst.object+json' : 'application/json' }),
  });
  if (res.status === 406 || res.status === 404) return { data: null };
  const data = await res.json();
  return { data: data || null };
}

async function sbInsert(table, body) {
  const res = await fetch(SB_URL() + '/rest/v1/' + table, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body),
  });
  return { error: res.ok ? null : await res.text() };
}

async function sbUpdate(table, filters, body) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method: 'PATCH',
    headers: sbHeaders({ 'Prefer': 'return=minimal' }),
    body: JSON.stringify(body),
  });
  return { error: res.ok ? null : await res.text() };
}

async function sbDelete(table, filters) {
  const params = new URLSearchParams(filters || {});
  const res = await fetch(SB_URL() + '/rest/v1/' + table + '?' + params.toString(), {
    method: 'DELETE',
    headers: sbHeaders(),
  });
  return { error: res.ok ? null : await res.text() };
}

// ─── ENTRY POINT ──────────────────────────────────────────────
export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch (e) { return NextResponse.json({ message: 'Invalid request', continueSession: false }, { status: 400 }); }

  console.error('[USSD] body:', JSON.stringify(body));

  const { sessionID, userID, newSession, msisdn, userData = '', network = '' } = body;

  if (!sessionID || !msisdn) {
    return NextResponse.json({ message: 'Bad request', continueSession: false }, { status: 400 });
  }

  const input = String(userData).trim();

  if (newSession === true || newSession === 'true') {
    await sbDelete('ussd_sessions', { 'session_id': 'eq.' + sessionID });
    await sbInsert('ussd_sessions', {
      session_id: sessionID,
      msisdn: msisdn,
      network: network,
      state: 'MAIN_MENU',
      data: {},
    });
    return respond(sessionID, userID, msisdn, mainMenu(), true);
  }

  const sessResult = await sbSelect('ussd_sessions', { 'session_id': 'eq.' + sessionID, 'select': '*' }, true);
  const sess = sessResult.data;

  if (!sess) {
    return respond(sessionID, userID, msisdn, 'Session expired.\n' + mainMenu(), true);
  }

  const session = { state: sess.state, data: sess.data || {} };
  const { nextState, nextData, message, end } = await transition(session, input, msisdn);

  if (end || nextState === 'END') {
    await sbDelete('ussd_sessions', { 'session_id': 'eq.' + sessionID });
    return respond(sessionID, userID, msisdn, message, false);
  }

  await sbUpdate('ussd_sessions', { 'session_id': 'eq.' + sessionID }, {
    state: nextState,
    data: nextData,
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
    if (input === '1') {
      return { nextState: 'BROWSE_EVENTS', nextData: data, message: await buildEventsMenu() };
    }
    if (input === '2') {
      return { nextState: 'MAIN_MENU', nextData: data, message: await myTicketsMenu(msisdn) };
    }
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
      nextData: { event_id: ev.id, event_title: ev.title },
      message: await buildTiersMenu(ev),
    };
  }

  if (state === 'SELECT_TIER') {
    if (input === '0') return { nextState: 'BROWSE_EVENTS', nextData: {}, message: await buildEventsMenu() };
    const tiers = await getTiers(data.event_id);
    const idx = parseInt(input, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= tiers.length) {
      return { nextState: 'SELECT_TIER', nextData: data, message: await buildTiersMenu({ id: data.event_id, title: data.event_title }, 'Invalid choice.\n') };
    }
    const tier = tiers[idx];
    const fee = parseFloat((tier.price * 0.05).toFixed(2));
    const total = parseFloat((tier.price + fee).toFixed(2));
    return {
      nextState: 'SELECT_QTY',
      nextData: { event_id: data.event_id, event_title: data.event_title, tier_id: tier.id, tier_name: tier.name, base_price: tier.price, fee, total_per_ticket: total },
      message: data.event_title + '\n' + tier.name + ': GHS ' + tier.price.toFixed(2) + '\nFee: GHS ' + fee.toFixed(2) + '\nTotal/ticket: GHS ' + total.toFixed(2) + '\n\nEnter quantity (1-5):\n0. Back',
    };
  }

  if (state === 'SELECT_QTY') {
    if (input === '0') return { nextState: 'SELECT_TIER', nextData: { event_id: data.event_id, event_title: data.event_title }, message: await buildTiersMenu({ id: data.event_id, title: data.event_title }) };
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 1 || qty > 5) {
      return { nextState: 'SELECT_QTY', nextData: data, message: 'Enter quantity (1-5):\n0. Back' };
    }
    const totalAmt = parseFloat((data.total_per_ticket * qty).toFixed(2));
    return {
      nextState: 'SELECT_NETWORK',
      nextData: { ...data, quantity: qty, total_amount: totalAmt },
      message: 'Total: GHS ' + totalAmt.toFixed(2) + ' for ' + qty + ' ticket(s)\n\nPay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back',
    };
  }

  if (state === 'SELECT_NETWORK') {
    if (input === '0') return { nextState: 'SELECT_QTY', nextData: data, message: data.event_title + '\n' + data.tier_name + ': GHS ' + data.base_price.toFixed(2) + '\n\nEnter quantity (1-5):\n0. Back' };
    if (!MOMO[input]) return { nextState: 'SELECT_NETWORK', nextData: data, message: 'Choose network:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back' };
    const net = MOMO[input];
    return {
      nextState: 'ENTER_PHONE',
      nextData: { ...data, momo_code: net.code, momo_label: net.label },
      message: net.label + ' selected.\n\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back',
    };
  }

  if (state === 'ENTER_PHONE') {
    if (input === '0') return { nextState: 'SELECT_NETWORK', nextData: data, message: 'Pay with:\n1. MTN MoMo\n2. Telecel Cash\n3. AirtelTigo\n0. Back' };
    const phone = normalisePhone(input);
    if (!phone) return { nextState: 'ENTER_PHONE', nextData: data, message: 'Invalid number.\nEnter MoMo number:\n(e.g. 0241234567)\n0. Back' };
    return {
      nextState: 'CONFIRM',
      nextData: { ...data, momo_phone: phone },
      message: 'Confirm order:\n' + data.event_title + '\n' + data.tier_name + ' x' + data.quantity + '\nGHS ' + data.total_amount.toFixed(2) + '\nFrom: ' + phone + '\n(' + data.momo_label + ')\n\n1. Confirm\n2. Cancel',
    };
  }

  if (state === 'CONFIRM') {
    if (input === '2' || input === '0') return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu('Order cancelled.\n') };
    if (input !== '1') return { nextState: 'CONFIRM', nextData: data, message: '1. Confirm\n2. Cancel' };

    const result = await initiatePayment(data, msisdn);

    // Paystack approved immediately (pay_offline — MoMo prompt sent to phone)
    if (result.success && result.paymentStatus === 'pay_offline') {
      return {
        end: true,
        message: 'Payment request sent!\nCheck your ' + data.momo_label + ' phone for a prompt and enter your PIN to complete.\n\nYour ticket will be sent by SMS once confirmed.',
      };
    }

    // Paystack requires OTP — collect it within the USSD session
    if (result.success && result.paymentStatus === 'send_otp') {
      return {
        nextState: 'ENTER_OTP',
        nextData: { ...data, ps_reference: result.reference },
        message: 'Enter the OTP sent to your ' + data.momo_label + ' number to complete payment:\n0. Cancel',
      };
    }

    // Paystack requires PIN entry via USSD prompt on their side (send_pin / pending)
    if (result.success && (result.paymentStatus === 'send_pin' || result.paymentStatus === 'pending')) {
      return {
        end: true,
        message: 'Payment initiated!\nApprove the ' + data.momo_label + ' prompt on your phone and enter your PIN.\n\nYour ticket will be sent by SMS once confirmed.',
      };
    }

    // Unexpected success status
    if (result.success) {
      return {
        end: true,
        message: 'Payment initiated!\nComplete any prompt on your ' + data.momo_label + ' phone.\n\nYour ticket will be sent by SMS once confirmed.',
      };
    }

    return { end: true, message: 'Payment failed.\n' + result.error + '\n\nDial again to retry.' };
  }

  // OTP collection state
  if (state === 'ENTER_OTP') {
    if (input === '0') return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu('Payment cancelled.\n') };
    if (!input || input.length < 4) {
      return { nextState: 'ENTER_OTP', nextData: data, message: 'Invalid OTP.\nEnter the OTP sent to your phone:\n0. Cancel' };
    }

    const otpResult = await submitOTP(input, data.ps_reference);

    if (otpResult.success) {
      return {
        end: true,
        message: 'Payment confirmed!\nYour ticket will be sent by SMS shortly.\n\nRef: ' + data.ps_reference,
      };
    }

    if (otpResult.retry) {
      return {
        nextState: 'ENTER_OTP',
        nextData: data,
        message: 'Wrong OTP. Try again:\n0. Cancel',
      };
    }

    return { end: true, message: 'Payment failed.\n' + otpResult.error + '\n\nDial again to retry.' };
  }

  return { nextState: 'MAIN_MENU', nextData: {}, message: mainMenu() };
}

// ─── PAYSTACK CHARGE ──────────────────────────────────────────
async function initiatePayment(data, msisdn) {
  const reference = 'USSD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const pesewas = Math.round(data.total_amount * 100);
  const guestEmail = 'ussd-' + data.momo_phone + '@ousted.live';
    // Paystack GHS expects local format 0XXXXXXXXX not 233XXXXXXXXX
    const paystackPhone = data.momo_phone.startsWith('233') ? '0' + data.momo_phone.slice(3) : data.momo_phone;

  try {
    const res = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: guestEmail, // was PLATFORM_EMAIL — unique per customer required for MoMo routing
        amount: pesewas,
        currency: 'GHS',
        mobile_money: { phone: paystackPhone, provider: data.momo_code },
        reference,
        metadata: {
          type: 'TICKET', channel: 'USSD',
          event_id: data.event_id, tier_id: data.tier_id,
          tier_name: data.tier_name, event_title: data.event_title,
          quantity: data.quantity, base_price: data.base_price,
          platform_fee: data.fee, buyer_price: data.total_per_ticket,
          guest_email: guestEmail, guest_name: 'USSD Buyer',
          ussd_phone: data.momo_phone, momo_provider: data.momo_label,
          organizer_owes: parseFloat((data.base_price * data.quantity).toFixed(2)),
          reseller_owes: 0, reseller_code: 'DIRECT', is_reseller_purchase: false,
        },
      }),
    });

    const ps = await res.json();
    console.error('[USSD] Paystack charge response:', JSON.stringify(ps));

    if (!ps.status) {
      return { success: false, error: ps.message || 'Payment service unavailable.' };
    }

    const paymentStatus = ps.data && ps.data.status;

    // If Paystack accepted the request but the charge itself failed, surface the error
    if (paymentStatus === 'failed') {
      const errMsg = (ps.data && ps.data.message) || ps.message || 'Charge failed.';
      console.error('[USSD] Charge failed:', errMsg);
      return { success: false, error: errMsg };
    }

    // Store pending record regardless of OTP requirement
    await sbInsert('ussd_pending', {
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
      momo_network: data.momo_code,
      status: 'pending',
    });

    return { success: true, reference, paymentStatus };

  } catch (err) {
    console.error('[USSD] Payment error:', err.message);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// ─── PAYSTACK OTP SUBMISSION ──────────────────────────────────
async function submitOTP(otp, reference) {
  try {
    const res = await fetch('https://api.paystack.co/charge/submit_otp', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp, reference }),
    });

    const ps = await res.json();
    console.error('[USSD] OTP submit response:', JSON.stringify(ps));

    if (!ps.status) {
      // Wrong OTP — let user retry
      if (ps.message && ps.message.toLowerCase().includes('otp')) {
        return { success: false, retry: true, error: ps.message };
      }
      return { success: false, retry: false, error: ps.message || 'OTP verification failed.' };
    }

    const paymentStatus = ps.data && ps.data.status;
    // success / pay_offline both mean payment is proceeding — webhook will fire
    return { success: true, paymentStatus };

  } catch (err) {
    console.error('[USSD] OTP submit error:', err.message);
    return { success: false, retry: false, error: 'Network error. Try again.' };
  }
}

// ─── DATA HELPERS ─────────────────────────────────────────────
async function getEvents() {
  const today = new Date().toISOString().split('T')[0];
  const result = await sbSelect('events', {
    'select': 'id,title,date,location',
    'status': 'eq.active',
    'is_deleted': 'eq.false',
    'date': 'gte.' + today,
    'order': 'date.asc',
    'limit': '8',
  });
  return result.data || [];
}

async function buildEventsMenu(prefix) {
  const events = await getEvents();
  if (!events.length) return 'No upcoming events.\n0. Back';
  const lines = events.map(function(e, i) {
    const dateStr = e.date ? new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    const title = e.title.length > 18 ? e.title.substring(0, 17) + '.' : e.title;
    return (i + 1) + '. ' + title + (dateStr ? ' ' + dateStr : '');
  }).join('\n');
  return (prefix || '') + 'Upcoming Events:\n' + lines + '\n0. Back';
}

async function getTiers(event_id) {
  const result = await sbSelect('ticket_tiers', {
    'select': 'id,name,price,max_quantity',
    'event_id': 'eq.' + event_id,
    'order': 'price.asc',
  });
  return result.data || [];
}

async function buildTiersMenu(event, prefix) {
  const tiers = await getTiers(event.id);
  if (!tiers.length) return 'No tickets available.\n0. Back';
  const title = event.title.length > 20 ? event.title.substring(0, 19) + '.' : event.title;
  const lines = tiers.map(function(t, i) { return (i + 1) + '. ' + t.name + ' - GHS ' + t.price.toFixed(2); }).join('\n');
  return (prefix || '') + title + '\nSelect tier:\n' + lines + '\n0. Back';
}

async function myTicketsMenu(msisdn) {
  const phone = normalisePhone(msisdn) || msisdn;
  const guestEmail = 'ussd-' + phone + '@ousted.live';
  const result = await sbSelect('tickets', {
    'select': 'ticket_number,tier_name',
    'guest_email': 'eq.' + guestEmail,
    'status': 'eq.valid',
    'order': 'created_at.desc',
    'limit': '3',
  });
  const data = result.data;
  if (!data || !data.length) return 'No tickets found for\n' + phone + '\n\nBuy tickets: option 1\n0. Back to menu';
  const lines = data.map(function(t, i) {
    return (i + 1) + '. #' + t.ticket_number + ' (' + (t.tier_name || 'GA') + ')';
  }).join('\n');
  return 'Your Tickets:\n' + lines + '\n\nousted.live/tickets/find\n0. Back';
}

// ─── UTILITY ──────────────────────────────────────────────────
function normalisePhone(input) {
  if (!input) return null;
  var p = String(input).replace(/[\s\-()]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     p = '233' + p.slice(1);
  if (/^\+233[2-9]\d{8}$/.test(p)) p = p.slice(1);
  return /^233[2-9]\d{8}$/.test(p) ? p : null;
}
