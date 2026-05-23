// app/api/organizer/phone-verify/route.js
// Two actions:
//   POST { action: 'send',   phone, userId }  → generates OTP, stores hash in DB, sends SMS
//   POST { action: 'verify', phone, otp, userId } → checks OTP, marks phone as verified
//
// OTP is a 6-digit code, valid for 10 minutes.
// We store a bcrypt-style SHA-256 hash + expiry in the profiles table columns:
//   otp_hash TEXT, otp_expires_at TIMESTAMPTZ, phone_number TEXT, phone_verified BOOLEAN

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendSMS } from '../../../../lib/sms.js';

export const runtime = 'nodejs';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Normalise Ghanaian phone to +233XXXXXXXXX */
function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))      return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))    return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p))  return p;
  return null;
}

/** SHA-256 hash of otp + secret salt */
function hashOtp(otp) {
  const salt = process.env.OTP_SECRET || 'ousted-otp-default-salt';
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

/** Verify user owns the session */
async function getAuthUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const supabase = db();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, phone, otp, userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();

    // ── SEND OTP ─────────────────────────────────────────────────────────────
    if (action === 'send') {
      const normalised = normalisePhone(phone);
      if (!normalised) {
        return NextResponse.json({ error: 'Invalid Ghanaian phone number. Use format: 0XXXXXXXXX' }, { status: 400 });
      }

      // Rate-limit: check if an OTP was sent in the last 60 seconds
      const { data: profile } = await supabase
        .from('profiles')
        .select('otp_expires_at')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.otp_expires_at) {
        const expires = new Date(profile.otp_expires_at).getTime();
        const tooSoon = expires - Date.now() > 9 * 60 * 1000; // sent less than 60s ago
        if (tooSoon) {
          return NextResponse.json({ error: 'Please wait 60 seconds before requesting another code.' }, { status: 429 });
        }
      }

      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const hash = hashOtp(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      // Persist hash + expiry + phone (unverified until confirmed)
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          phone_number: normalised,
          otp_hash: hash,
          otp_expires_at: expiresAt,
          phone_verified: false,
        })
        .eq('id', userId);

      if (updateErr) {
        console.error('[OTP] DB update error:', updateErr.message);
        return NextResponse.json({ error: 'Could not save OTP. Please try again.' }, { status: 500 });
      }

      // Send SMS
      const smsResult = await sendSMS(
        normalised,
        `Your OUSTED verification code is: ${code}\n\nValid for 10 minutes. Do not share this code.`
      );

      if (!smsResult.success) {
        console.error('[OTP] SMS failed:', smsResult.error);
        return NextResponse.json({ error: `SMS delivery failed: ${smsResult.error}` }, { status: 500 });
      }

      console.log(`[OTP] Sent to ${normalised} for user ${userId}`);
      return NextResponse.json({ success: true, message: `Verification code sent to ${normalised}` });
    }

    // ── VERIFY OTP ───────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!otp || !/^\d{6}$/.test(otp)) {
        return NextResponse.json({ error: 'Enter the 6-digit code from your SMS.' }, { status: 400 });
      }

      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('otp_hash, otp_expires_at, phone_number')
        .eq('id', userId)
        .maybeSingle();

      if (fetchErr || !profile) {
        return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
      }

      if (!profile.otp_hash || !profile.otp_expires_at) {
        return NextResponse.json({ error: 'No pending verification. Please request a new code.' }, { status: 400 });
      }

      if (new Date(profile.otp_expires_at) < new Date()) {
        return NextResponse.json({ error: 'Code has expired. Please request a new one.' }, { status: 400 });
      }

      const expected = hashOtp(otp);
      if (expected !== profile.otp_hash) {
        return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
      }

      // Mark verified, clear OTP fields
      await supabase
        .from('profiles')
        .update({
          phone_verified: true,
          otp_hash: null,
          otp_expires_at: null,
        })
        .eq('id', userId);

      console.log(`[OTP] Phone verified for user ${userId}: ${profile.phone_number}`);
      return NextResponse.json({ success: true, phone: profile.phone_number });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err) {
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
