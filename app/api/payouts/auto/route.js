import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST() {
  try {
    /* 1. Find eligible resellers */
    const { data: resellers } = await supabase
      .from("resellers")
      .select("*")
      .gte("total_earned", supabase.raw("payout_threshold"))
      .not("payout_recipient_code", "is", null);

    for (const reseller of resellers) {
      /* 2. Get unpaid commissions */
      const { data: sales } = await supabase
        .from("reseller_sales")
        .select("*")
        .eq("reseller_id", reseller.id)
        .eq("paid", false);

      if (!sales?.length) continue;

      const payoutAmount = sales.reduce(
        (sum, s) => sum + parseFloat(s.commission_amount),
        0
      );

      /* 3. Initiate Paystack transfer */
      const transferRes = await fetch(
        "https://api.paystack.co/transfer",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(payoutAmount * 100),
            recipient: reseller.payout_recipient_code,
            reason: "Reseller commission payout"
          })
        }
      );

      const transferData = await transferRes.json();
      if (!transferData.status) continue;

      /* 4. Mark sales as paid */
      await supabase
        .from("reseller_sales")
        .update({
          paid: true,
          payout_reference: transferData.data.reference
        })
        .eq("reseller_id", reseller.id)
        .eq("paid", false);

      /* 5. Reset reseller balance */
      await supabase
        .from("resellers")
        .update({
          total_earned: 0,
          last_payout_at: new Date()
        })
        .eq("id", reseller.id);
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Auto payout error:", err);
    return NextResponse.json({ error: "Payout failed" }, { status: 500 });
  }
}
