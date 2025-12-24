import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2'
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

serve(async (req) => {
  // 1. Verify Paystack Signature (Crucial for Security)
  const signature = req.headers.get('x-paystack-signature');
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  // Logic to verify HMAC goes here... (Optional but recommended)

  const body = await req.json();
  const { event, data } = body;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log(`Processing Paystack event: ${event}`);

  // Handle Transfer Status Updates
  const statusMap = {
    'transfer.success': 'success',
    'transfer.failed': 'failed',
    'transfer.reversed': 'reversed'
  };

  const newStatus = statusMap[event];

  if (newStatus) {
    const { error } = await supabase
      .from('payouts')
      .update({ status: newStatus })
      .eq('paystack_transfer_code', data.transfer_code);

    if (error) {
      console.error('Update failed:', error);
      return new Response("Error updating database", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { 
    headers: { "Content-Type": "application/json" },
    status: 200 
  });
})
