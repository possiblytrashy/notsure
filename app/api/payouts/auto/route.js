import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with server-side service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST() {
  try {
    // --- 1. Find eligible resellers ---
    const { data: resellers, error: resellersError } = await supabase
      .from("resellers")
      .select("*")
      .gte("total_earned", supabase.raw("payout_threshold"))
      .not("payout_recipient_code", "is", null);

    if (resellersError) {
      console.error("Error fetching eligible resellers:", resellersError);
      return NextResponse.json({ error: "Failed to fetch resellers" }, { status: 500 });
    }

    if (!resellers?.length) {
      console.log("No resellers eligible for payout at this time.");
      return NextResponse.json({ success: true, message: "No eligible resellers." });
    }

    // --- 2. Process each reseller ---
    for (const reseller of resellers) {
      // Fetch unpaid commissions
      const { data: sales, error: salesError } = await supabase
        .from("reseller_sales")
        .select("*")
        .eq("reseller_id", reseller.id)
        .eq("paid", false);

      if (salesError) {
        console.error(`Error fetching sales for reseller ${reseller.id}:`, salesError);
        continue; // skip this reseller
      }

      if (!sales?.length) {
        console.log(`No unpaid sales for reseller ${reseller.id}`);
        continue;
      }

      // Calculate payout amount
      const payoutAmount = sales.reduce(
        (sum, sale) => sum + parseFloat(sale.commission_amount),
        0
      );

      if (payoutAmount <= 0) {
        console.log(`Reseller ${reseller.id} payout amount is zero. Skipping.`);
        continue;
      }

      // --- 3. Initiate Paystack transfer ---
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "balance",
          amount: Math.round(payoutAmount * 100), // Paystack expects kobo/pesewa
          recipient: reseller.payout_recipient_code,
          reason: "Reseller commission payout"
        })
      });

      const transferData = await transferRes.json();

      if (!transferData.status) {
        console.error(`Paystack transfer failed for reseller ${reseller.id}:`, transferData);
        continue;
      }

      console.log(`Transfer successful for reseller ${reseller.id}:`, transferData.data.reference);

      // --- 4. Mark sales as paid ---
      const { error: updateSalesError } = await supabase
        .from("reseller_sales")
        .update({
          paid: true,
          payout_reference: transferData.data.reference
        })
        .eq("reseller_id", reseller.id)
        .eq("paid", false);

      if (updateSalesError) {
        console.error(`Failed to update sales for reseller ${reseller.id}:`, updateSalesError);
      }

      // --- 5. Reset reseller balance ---
      const { error: resetBalanceError } = await supabase
        .from("resellers")
        .update({
          total_earned: 0,
          last_payout_at: new Date().toISOString()
        })
        .eq("id", reseller.id);

      if (resetBalanceError) {
        console.error(`Failed to reset balance for reseller ${reseller.id}:`, resetBalanceError);
      }
    }

    return NextResponse.json({ success: true, message: "Payout process completed." });

  } catch (err) {
    console.error("Auto payout error:", err);
    return NextResponse.json({ error: "Payout failed" }, { status: 500 });
  }
}
