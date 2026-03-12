/**
 * Creates a Payment Split on Paystack and returns the Split Code.
 * * @param {string} splitName - Unique name (e.g., "Event: Luxury Gala - Direct")
 * @param {Array} subaccounts - Array of { subaccount: "ACCT_xxx", share: 50 }
 * @returns {Promise<string>} - The SPL_xxxx code
 */
export async function createPaystackSplit(splitName, subaccounts) {
  const url = "https://api.paystack.co/split";
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: splitName,
        type: "percentage",
        currency: "GHS",
        subaccounts: subaccounts, 
        bearer_type: "account", // Main account (You) bears the Paystack processing fees
      }),
    });

    const data = await response.json();

    if (!data.status) {
      console.error("Paystack Split Error:", data.message);
      throw new Error(data.message);
    }

    return data.data.split_code;
  } catch (error) {
    console.error("Split Creation Failed:", error);
    return null;
  }
}
