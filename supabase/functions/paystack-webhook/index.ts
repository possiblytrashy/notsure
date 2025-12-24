import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2'

serve(async (req) => {
  const body = await req.json()
  
  // Create Supabase Admin Client (to bypass RLS for system updates)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const event = body.event;
  const data = body.data;

  // Listen specifically for Transfer events
  if (event === 'transfer.success') {
    await supabase
      .from('payouts')
      .update({ status: 'success' })
      .eq('paystack_transfer_code', data.transfer_code);
  }

  if (event === 'transfer.failed') {
    await supabase
      .from('payouts')
      .update({ status: 'failed' })
      .eq('paystack_transfer_code', data.transfer_code);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
