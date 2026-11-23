/**
 * Test script for Hik-Partner Pro OpenAPI
 * Usage:
 *   node test-hikpartner.js gKGPcL7Pcs TvQxttmM4e
 */

const https = require("https");

const appKey = process.argv[2] || process.env.HIK_PARTNER_KEY || "gKGPcL7Pcs";
const secretKey = process.argv[3] || process.env.HIK_PARTNER_SECRET || "";
const baseDomain = "isgp.hik-partner.com";

if (!secretKey) {
  console.log("Usage: node test-hikpartner.js <YOUR_API_KEY> <YOUR_API_SECRET>");
  process.exit(1);
}

console.log(`Connecting to Hik-Partner Pro OpenAPI (${baseDomain}) ...`);
console.log(`Account (API Key): ${appKey}`);

function request(urlStr, method, headers, postData) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);
    if (postData) req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function run() {
  try {
    // 1. Get Access Token
    const tokenRes = await request(
      `https://${baseDomain}/api/hpcgw/v1/token/get`,
      "POST",
      { "Content-Type": "application/json" },
      { appKey, secretKey }
    );

    console.log("Token Response:", JSON.stringify(tokenRes.data, null, 2));

    const tokenData = tokenRes.data?.data;
    if (!tokenData || !tokenData.accessToken) {
      console.log("\n❌ Failed to obtain accessToken. Check credentials.");
      return;
    }

    const accessToken = tokenData.accessToken;
    let areaDomain = tokenData.areaDomain || "https://apiisgp.hik-partner.com";
    if (!areaDomain.startsWith("http")) areaDomain = `https://${areaDomain}`;

    console.log("\n✅ SUCCESS! Authentication verified.");
    console.log(`Access Token : ${accessToken}`);
    console.log(`Area Gateway : ${areaDomain}`);

    // 2. Fetch Device List from Hik-Partner Pro
    console.log("\nFetching registered devices from Hik-Partner Pro cloud...");
    const deviceRes = await request(
      `${areaDomain}/api/hpcgw/v1/device/list`,
      "POST",
      {
        "Content-Type": "application/json",
        Token: accessToken,
        Authorization: `Bearer ${accessToken}`,
      },
      { pageNo: 1, pageSize: 50 }
    );

    console.log("\nDevices Response:", JSON.stringify(deviceRes.data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
