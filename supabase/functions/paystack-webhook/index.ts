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

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"]
  );

  // Convert hex signature to Uint8Array for verification
  const sigBytes = new Uint8Array(signature?.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
  const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));

  if (!isValid) {
    return new Response("Unauthorized Signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const { event, data } = body;

  try {
    // --- SCENARIO A: PAYMENT SUCCESS (TICKETS, VOTING & RESELLER TRACKING) ---
    if (event === "charge.success") {
      const { reference, metadata, amount, customer } = data;
      const { event_id, tier_id, guest_name, vote_candidate_id, reseller_code } = metadata;

      // 1. FINALISE TICKET & ATTACH TIER DATA
      // Using upsert with onConflict 'reference' ensures idempotent processing
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

      // 2. LOG RESELLER COMMISSION (10%)
      // If a reseller_code exists, we calculate and log the commission for payout automation
      if (reseller_code) {
        const commissionAmount = (amount / 100) * 0.10;
        
        // Find the reseller by code and update their total_earned
        const { data: resellerLink } = await supabase
          .from("event_resellers")
          .select("reseller_id, id")
          .eq("unique_code", reseller_code)
          .single();

        if (resellerLink) {
          // Increment the total earned in the reseller profile
          await supabase.rpc('increment_reseller_earnings', { 
            reseller_row_id: resellerLink.reseller_id, 
            amount_to_add: commissionAmount 
          });

          // Log the individual sale for the reseller's dashboard
          await supabase.from("reseller_sales").insert({
            reseller_link_id: resellerLink.id,
            ticket_id: ticket.id,
            commission_earned: commissionAmount
          });
        }
      }

      // 3. PROCESS VOTING (Luxury Multi-Tier Logic)
      if (vote_candidate_id) {
        await supabase.from("votes").insert({
          candidate_id: vote_candidate_id,
          ticket_ref: reference,
          weight: 1, 
        });
        await supabase.rpc('increment_vote_count', { candidate_row_id: vote_candidate_id });
      }

      // 4. SEND LUXURY EMAIL VIA RESEND
      const qrPayload = encodeURIComponent(`REF:${reference}|EVT:${event_id}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrPayload}`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "The Concierge <access@yourluxurybrand.com>",
          to: [customer.email],
          subject: `Exclusive Access Granted: ${ticket.events.title}`,
          html: `
            <div style="background-color: #000; color: #fff; font-family: 'Garamond', serif; max-width: 600px; margin: auto; padding: 60px; border: 1px solid #CDa434; text-align: center;">
              <h1 style="letter-spacing: 10px; font-weight: 100; color: #CDa434;">AUTHENTICATED</h1>
              <p style="text-transform: uppercase; font-size: 14px; letter-spacing: 2px; color: #888;">${ticket.events.title}</p>
              <hr style="width: 100px; border: 0.5px solid #CDa434; margin: 30px auto;" />
              <p style="font-size: 18px;">Welcome, <strong>${guest_name}</strong></p>
              <p style="font-size: 15px; opacity: 0.8;">Your <strong>${ticket.ticket_tiers.name}</strong> access is officially secured.</p>
              <div style="margin: 40px 0; background: #fff; display: inline-block; padding: 20px; borderRadius: 15px;">
                <img src="${qrUrl}" width="220" />
              </div>
              <p style="font-size: 12px; color: #CDa434; letter-spacing: 2px;">REF: ${reference}</p>
              <div style="margin-top: 40px; font-size: 11px; color: #444; text-transform: uppercase;">
                Digital Ticket • Non-Transferable • Invitation Only
              </div>
            </div>
          `,
        }),
      });
    }

    // --- SCENARIO B: PAYOUT STATUS UPDATES (For Resellers/Organizers) ---
    const payoutStatuses = {
      'transfer.success': 'completed',
      'transfer.failed': 'failed',
      'transfer.reversed': 'reversed'
    };

    if (payoutStatuses[event]) {
      await supabase
        .from("payouts")
        .update({ 
          status: payoutStatuses[event],
          completed_at: new Date().toISOString()
        })
        .eq("paystack_transfer_code", data.transfer_code);
    }

    return new Response(JSON.stringify({ status: "success" }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("Critical Webhook Failure:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
