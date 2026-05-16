// lib/sms.js — Arkesel SMS helper (shared across webhook handlers)

/**
 * Send an SMS via the Arkesel API v2.
 * Returns { success: true } or { success: false, error: string }.
 *
 * Required env vars:
 *   ARKESEL_API_KEY    — your Arkesel API key
 *   ARKESEL_SENDER_ID  — e.g. "OUSTED" (max 11 chars, alphanumeric)
 */
export async function sendSMS(to, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || 'OUSTED';

  if (!apiKey) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping SMS');
    return { success: false, error: 'SMS not configured' };
  }

  // Normalise the phone number to international format (+233…)
  const phone = normalisePhone(to);
  if (!phone) {
    console.warn('[SMS] Could not normalise phone:', to);
    return { success: false, error: 'Invalid phone number' };
  }

  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        message,
        recipients: [phone],
      }),
    });

    const data = await res.json();

    if (data.status === 'success') {
      console.log(`[SMS] ✅ Sent to ${phone}`);
      return { success: true };
    }

    console.error('[SMS] Arkesel error:', JSON.stringify(data));
    return { success: false, error: data.message || 'Send failed' };
  } catch (err) {
    console.error('[SMS] Network error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Normalise a Ghanaian phone number to +233XXXXXXXXX.
 * Accepts: 0XXXXXXXXX, 233XXXXXXXXX, +233XXXXXXXXX
 */
function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p)) return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p)) return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(input.replace(/[\s\-()]/g, ''))) return input.replace(/[\s\-()]/g, '');
  return null;
}
