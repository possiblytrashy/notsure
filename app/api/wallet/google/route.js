// Google Wallet pass — Generic Pass JWT approach
// No extra npm packages needed (uses native crypto for RS256 signing)
// Setup: https://developers.google.com/wallet/generic/web
// Env vars: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_KEY_FILE_JSON (service account JSON as string)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Manual RS256 JWT signing without jsonwebtoken package
function signJwt(payload, privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  // RS256 uses PKCS1 padding which is the default for RSA in Node
  const sigRS = crypto.sign('sha256', Buffer.from(data), privateKey);
  return `${data}.${sigRS.toString('base64url')}`;
}

function fmtDate(d, t) {
  if (!d) return 'TBA';
  const date = new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  return t ? `${date} · ${t.substring(0, 5)}` : date;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get('ref');
  const email = searchParams.get('email');
  if (!ref || !email) return NextResponse.json({ error: 'Missing ref or email' }, { status: 400 });

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const keyFileJson = process.env.GOOGLE_WALLET_KEY_FILE_JSON;

  if (!issuerId || !keyFileJson) {
    return NextResponse.json({
      error: 'Google Wallet not configured',
      instructions: [
        '1. Go to https://console.cloud.google.com → Create project',
        '2. Enable "Google Wallet API"',
        '3. Create a Service Account → download JSON key',
        '4. Go to https://pay.google.com/business/console → create Issuer account',
        '5. Set GOOGLE_WALLET_ISSUER_ID = your numeric issuer ID',
        '6. Set GOOGLE_WALLET_KEY_FILE_JSON = contents of the service account JSON file',
      ]
    }, { status: 501 });
  }

  const supabase = db();
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, events!event_id(id,title,date,time,location,image_url,organizer_id), ticket_tiers:tier_id(name)')
    .eq('reference', ref)
    .eq('guest_email', email.toLowerCase())
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found or not yours' }, { status: 404 });
  if (ticket.status !== 'valid') return NextResponse.json({ error: 'Ticket is not valid' }, { status: 400 });

  const ev = ticket.events || {};
  const tier = ticket.ticket_tiers?.name || ticket.tier_name || 'General Admission';
  const creds = JSON.parse(keyFileJson);
  const classId = `${issuerId}.ousted_event_ticket_v1`;
  const objectId = `${issuerId}.${ref.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Ensure class exists (idempotent upsert via Google Wallet API)
  const accessTokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signJwt({
        iss: creds.client_email,
        sub: creds.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      }, creds.private_key),
    }),
  });
  const { access_token } = await accessTokenRes.json();
  const authH = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

  // Upsert the Generic Class
  await fetch(`https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${classId}`, {
    method: 'PUT',
    headers: authH,
    body: JSON.stringify({ id: classId, multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES' }),
  }).catch(() => {});

  // Build pass object
  const passObj = {
    id: objectId,
    classId,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: '#0a0a0a',
    logo: { sourceUri: { uri: `${SITE_URL}/api/icon?size=192&bg=000000&fg=CDA434` }, contentDescription: { defaultValue: { language: 'en-US', value: 'OUSTED' } } },
    cardTitle: { defaultValue: { language: 'en-US', value: 'OUSTED TICKET' } },
    subheader: { defaultValue: { language: 'en-US', value: tier.toUpperCase() } },
    header: { defaultValue: { language: 'en-US', value: ev.title || 'Event Ticket' } },
    textModulesData: [
      { id: 'date', header: 'DATE & TIME', body: fmtDate(ev.date, ev.time) },
      { id: 'venue', header: 'VENUE', body: ev.location || 'TBA' },
      { id: 'holder', header: 'TICKET HOLDER', body: ticket.guest_name || 'Guest' },
      { id: 'tier', header: 'TICKET TYPE', body: tier },
      { id: 'ref', header: 'REFERENCE', body: ref },
    ],
    barcode: { type: 'QR_CODE', value: `REF:${ref}`, alternateText: ref },
    ...(ev.image_url ? { heroImage: { sourceUri: { uri: ev.image_url }, contentDescription: { defaultValue: { language: 'en-US', value: ev.title } } } } : {}),
    linksModuleData: { uris: [{ uri: `${SITE_URL}/events/${ev.id}`, description: 'View Event', id: 'event' }] },
    validTimeInterval: ev.date ? {
      start: { date: new Date(ev.date).toISOString() },
      end: { date: new Date(new Date(ev.date).getTime() + 86400000).toISOString() },
    } : undefined,
  };

  // Sign JWT for Save-to-Wallet button
  const jwt = signJwt({
    iss: creds.client_email,
    aud: 'google',
    origins: [SITE_URL],
    iat: Math.floor(Date.now() / 1000),
    typ: 'savetowallet',
    payload: { genericObjects: [passObj] },
  }, creds.private_key);

  return NextResponse.json({ url: `https://pay.google.com/gp/v/save/${jwt}` });
}
