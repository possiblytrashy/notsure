import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-client@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

serve(async (req) => {
  // 1. MUST HANDLE OPTIONS FOR CORS (Fixes your preflight error)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. SECURE SIGNATURE VERIFICATION (Refined for Deno Crypto)
  const signature = req.headers.get("x-paystack-signature");
  if (!signature) {
    return new Response("Missing Signature", { status: 401, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(PAYSTACK_SECRET_KEY);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"] // Correct usage for checking Paystack's signature
  );

  // Convert Paystack's Hex signature to a Uint8Array for verification
  const hexToUint8Array = (hex: string) => 
    new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    hexToUint8Array(signature),
    encoder.encode(rawBody)
  );

  if (!isValid) {
    console.error("Signature mismatch");
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const body = JSON.parse(rawBody);
  const { event, data } = body;

  try {
    // --- SCENARIO A: PAYMENT SUCCESS ---
    if (event === "charge.success") {
      const { reference, metadata, amount, customer, subaccount } = data;
      const { event_id, tier_id, guest_name, vote_candidate_id, reseller_code } = metadata;

      // 1. TICKET UPSERT (Multi-tier support)
      const { data: ticket, error: ticketErr } = await supabase
        .from("tickets")
        .upsert({
          reference,
          event_id,
          guest_name: guest_name || "Valued Guest",
          guest_email: customer.email,
          tier_id,
          amount: amount / 100, // Paystack is in kobo
          status: "valid",
          reseller_code: reseller_code || null,
        }, { onConflict: 'reference' })
        .select('*, events(title, location_name, event_date), ticket_tiers(name)')
        .single();

      if (ticketErr) throw ticketErr;

      // 2. RESELLER COMMISSION LOGIC (10%)
      if (reseller_code) {
        const commissionAmount = (amount / 100) * 0.10;
        await supabase.rpc('process_reseller_commission', { 
          look_up_code: reseller_code, 
          commission_value: commissionAmount,
          ref: reference
        });
      }

      // 3. VOTING LOGIC
      if (vote_candidate_id) {
        await supabase.from("votes").insert({
          candidate_id: vote_candidate_id,
          ticket_ref: reference,
        });
        await supabase.rpc('increment_vote_count', { candidate_row_id: vote_candidate_id });
      }

      // 4. LUXURY EMAIL (RESEND)
      const qrPayload = encodeURIComponent(`REF:${reference}|EVT:${event_id}`);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrPayload}`;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "The Concierge <access@ousted.app>", // Update to your verified domain
          to: [customer.email],
          subject: `Access Confirmed: ${ticket.events.title}`,
          html: `
            <div style="font-family: Garamond, serif; max-width: 600px; margin: auto; padding: 50px; border: 1px solid #d4af37; background: #000; color: #fff; text-align: center;">
              <h1 style="letter-spacing: 8px; color: #d4af37;">AUTHENTICATED</h1>
              <p style="text-transform: uppercase; font-size: 14px; opacity: 0.7;">${ticket.events.title}</p>
              <hr style="width: 80px; border: 0.5px solid #d4af37; margin: 30px auto;" />
              <p style="font-size: 18px;">Welcome, <strong>${guest_name}</strong></p>
              <p>Your <strong>${ticket.ticket_tiers.name}</strong> pass is ready.</p>
              <div style="margin: 40px 0; background: #fff; padding: 20px; display: inline-block; border-radius: 4px;">
                <img src="${qrUrl}" width="200" />
              </div>
              <p style="font-size: 12px; color: #d4af37;">REFERENCE: ${reference}</p>
              <p style="font-size: 10px; margin-top: 40px; opacity: 0.5;">Presented by Ousted Luxury</p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        console.error("Resend Error:", await emailResponse.text());
      }
    }

    // --- SCENARIO B: PAYOUT STATUS ---
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

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error("Critical Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
