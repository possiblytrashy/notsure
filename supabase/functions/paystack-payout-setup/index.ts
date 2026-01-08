// paystack-payout-setup/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { account_number, bank_code, type, currency } = await req.json()
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY')

    // 1. Resolve Account (Check if name exists)
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    )
    const resolveData = await resolveRes.json()
    if (!resolveData.status) throw new Error("Could not verify account name")

    // 2. Create Transfer Recipient
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: type || "ghipss",
        name: resolveData.data.account_name,
        account_number: account_number,
        bank_code: bank_code,
        currency: currency || "GHS",
      }),
    })
    const recipientData = await recipientRes.json()

    return new Response(JSON.stringify({ 
      recipient_code: recipientData.data.recipient_code,
      account_name: resolveData.data.account_name 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
