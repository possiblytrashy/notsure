serve(async (req) => {
  // 1. HANDLE CORS PREFLIGHT (Must be first!)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. IDENTIFY THE CALLER
  const signature = req.headers.get("x-paystack-signature");

  // IF NO SIGNATURE: It's your Frontend calling for 'Payout Setup'
  if (!signature) {
    try {
      const body = await req.json();
      // Only allow the Frontend to call Payout Setup logic
      return await handlePayoutSetup(body); 
    } catch (err) {
      return new Response("Unauthorized or Bad Request", { status: 401, headers: corsHeaders });
    }
  }

  // IF SIGNATURE EXISTS: It's Paystack calling the Webhook
  const rawBody = await req.text();
  // ... (Your existing crypto.subtle.verify logic here) ...
  
  if (!isValid) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const body = JSON.parse(rawBody);
  // ... (Your existing charge.success logic here) ...
});

// Helper function for your "Verify & Join" button
async function handlePayoutSetup(body) {
  const { account_number, bank_code, type } = body;
  const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");

  // Call Paystack Resolve API
  const res = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
  });
  const data = await res.json();

  if (!data.status) throw new Error("Invalid Account");

  // Call Paystack Create Recipient API
  const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${PAYSTACK_SECRET}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      type: type || "ghipss",
      name: data.data.account_name,
      account_number,
      bank_code,
      currency: "GHS"
    })
  });
  const recipientData = await recipientRes.json();

  return new Response(JSON.stringify({
    recipient_code: recipientData.data.recipient_code,
    account_name: data.data.account_name
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
