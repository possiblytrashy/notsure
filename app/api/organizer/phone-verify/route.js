// app/api/organizer/phone-verify/route.js
//
// THREE distinct actions — each has a clear, separate purpose:
//
//   POST { action: 'set-phone', phone, userId }
//     → Used ONCE during initial setup (or when organizer wants to change their number).
//       Accepts a phone number, stores it (unverified), sends OTP to that number.
//
//   POST { action: 'send', userId }
//     → Used every time payout settings are about to change.
//       NEVER accepts a phone param — always reads the stored phone_number from DB.
//       Sending to an arbitrary number is impossible.
//
//   POST { action: 'verify', otp, userId }
//     → Checks the submitted code. Works for both set-phone and send flows.
//       On success: marks phone_verified = true and clears OTP fields.

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

function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))      return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))    return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p))  return p;
  return null;
}

function hashOtp(otp) {
  const salt = process.env.OTP_SECRET || 'ousted-otp-default-salt';
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

/** Generate OTP, store hash, send SMS. Returns { success, message } or throws. */
async function issueOtp(supabase, userId, phoneToSend, persistPhone = false) {
  // Rate-limit: block if OTP was issued less than 60 seconds ago
  const { data: profile } = await supabase
    .from('profiles')
    .select('otp_expires_at')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.otp_expires_at) {
    const msRemaining = new Date(profile.otp_expires_at).getTime() - Date.now();
    if (msRemaining > 9 * 60 * 1000) { // more than 9 min left = sent < 60s ago
      throw { status: 429, message: 'Please wait 60 seconds before requesting another code.' };
    }
  }

  const code      = String(Math.floor(100000 + Math.random() * 900000));
  const hash      = hashOtp(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const updatePayload = { otp_hash: hash, otp_expires_at: expiresAt };
  // Only write phone_number when explicitly setting a new one (set-phone flow)
  if (persistPhone) updatePayload.phone_number = phoneToSend;

  const { error: dbErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (dbErr) throw { status: 500, message: 'Could not save OTP. Please try again.' };

  const smsResult = await sendSMS(
    phoneToSend,
    `Your OUSTED verification code is: ${code}\n\nValid for 10 minutes. Do not share this code with anyone.`
  );
  if (!smsResult.success) throw { status: 500, message: `SMS delivery failed: ${smsResult.error}` };

  console.log(`[OTP] Sent to ${phoneToSend} for user ${userId}`);
  return { success: true, message: `Verification code sent to ${phoneToSend}` };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, phone, otp, userId } = body;

    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = db();

    // ── SET-PHONE: one-time phone registration / number change ─────────────────
    // Accepts a phone number, saves it as unverified, sends OTP to it.
    // This is the ONLY action that accepts a phone parameter.
    if (action === 'set-phone') {
      const normalised = normalisePhone(phone);
      if (!normalised) {
        return NextResponse.json(
          { error: 'Invalid Ghanaian phone number. Use format: 0XXXXXXXXX or +233...' },
          { status: 400 }
        );
      }

      // Mark as unverified while the new number is being confirmed
      await supabase
        .from('profiles')
        .update({ phone_verified: false })
        .eq('id', userId);

      const result = await issueOtp(supabase, userId, normalised, /* persistPhone */ true);
      return NextResponse.json(result);
    }

    // ── SEND: payout-gate OTP — always sends to the stored number ──────────────
    // Accepts NO phone parameter. Reads from DB. Cannot be redirected to another number.
    if (action === 'send') {
      const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('phone_number, phone_verified')
        .eq('id', userId)
        .maybeSingle();

      if (fetchErr || !profile) {
        return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
      }
      if (!profile.phone_number) {
        return NextResponse.json(
          { error: 'No phone number on file. Please set a verified phone number in your account settings first.' },
          { status: 400 }
        );
      }
      if (!profile.phone_verified) {
        return NextResponse.json(
          { error: 'Your phone number is not yet verified. Please complete phone verification first.' },
          { status: 400 }
        );
      }

      const result = await issueOtp(supabase, userId, profile.phone_number, /* persistPhone */ false);
      return NextResponse.json(result);
    }

    // ── VERIFY: check OTP code ─────────────────────────────────────────────────
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

      // Mark verified, clear OTP so it can't be reused
      await supabase
        .from('profiles')
        .update({ phone_verified: true, otp_hash: null, otp_expires_at: null })
        .eq('id', userId);

      console.log(`[OTP] ✅ Verified for user ${userId}: ${profile.phone_number}`);
      return NextResponse.json({ success: true, phone: profile.phone_number });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });

  } catch (err) {
    if (err.status && err.message) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
