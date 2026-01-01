import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // 1. SECURE SIGNATURE VERIFICATION
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  // Validate that the request actually came from Paystack
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expectedSignature) {
    return new Response("Invalid Signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const { event, data } = body;

  try {
    // --- SCENARIO A: PAYMENT SUCCESS (TICKETS & VOTING) ---
    if (event === "charge.success") {
      const { reference, metadata, amount, customer } = data;
      
      // Metadata extraction (sent during Paystack.initialize)
      const { event_id, tier_id, guest_name, vote_candidate_id, reseller_code } = metadata;

      // 1. FINALISE TICKET (Upsert to prevent race conditions with frontend)
      const { data: ticket, error: ticketErr } = await supabase
        .from("tickets")
        .upsert({
          reference,
          event_id,
          guest_name: guest_name || "Valued Guest",
          guest_email: customer.email,
          tier_id,
          amount: amount / 100,
          status: "valid",
          reseller_code: reseller_code || null,
        }, { onConflict: 'reference' })
        .select('*, events(title, location_name, event_date), ticket_tiers(name)')
        .single();

      if (ticketErr) throw ticketErr;

      // 2. PROCESS VOTING (If this was a "Vote-to-Enter" or "Paid Vote" luxury event)
      if (vote_candidate_id) {
        // We record the vote linked to this transaction reference
        await supabase.from("votes").insert({
          candidate_id: vote_candidate_id,
          ticket_ref: reference,
          weight: 1, // You can scale this based on amount if needed
        });
        
        // Update the candidate's total count
        await supabase.rpc('increment_vote_count', { candidate_row_id: vote_candidate_id });
      }

      // 3. SEND LUXURY EMAIL VIA RESEND
      const qrPayload = encodeURIComponent(`REF:${reference}|EVT:${event_id}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrPayload}`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "The Concierge <access@yourdomain.com>",
          to: [customer.email],
          subject: `Your Access Code for ${ticket.events.title}`,
          html: `
            <div style="font-family: 'Garamond', serif; max-width: 500px; margin: auto; padding: 40px; border: 1px solid #d4af37; text-align: center;">
              <h1 style="letter-spacing: 5px; font-weight: 100;">CONFIRMED</h1>
              <p style="text-transform: uppercase; font-size: 12px; color: #888;">${ticket.events.title}</p>
              <hr style="width: 50px; border: 0.5px solid #d4af37; margin: 20px auto;" />
              <p>Welcome, <strong>${guest_name}</strong></p>
              <p style="font-size: 14px;">Your <strong>${ticket.ticket_tiers.name}</strong> access has been secured.</p>
              <div style="margin: 30px 0;">
                <img src="${qrUrl}" width="200" style="border: 1px solid #eee; padding: 10px;" />
              </div>
              <p style="font-size: 10px; color: #aaa;">REF: ${reference}</p>
              ${vote_candidate_id ? `<p style="font-size: 12px; font-style: italic;">Your vote has been officially cast.</p>` : ''}
            </div>
          `,
        }),
      });
    }

    // --- SCENARIO B: PAYOUT UPDATES ---
    const payoutStatuses = {
      'transfer.success': 'completed',
      'transfer.failed': 'failed',
      'transfer.reversed': 'reversed'
    };

    if (payoutStatuses[event]) {
      await supabase
        .from("payouts")
        .update({ status: payoutStatuses[event] })
        .eq("paystack_transfer_code", data.transfer_code);
    }

    return new Response(JSON.stringify({ status: "success" }), { status: 200 });

  } catch (err) {
    console.error("Webhook Logic Error:", err.message);
    return new Response("Critical Error", { status: 500 });
  }
});
