/**
 * Test script for Hik-Partner Pro OpenAPI
 * Usage:
 *   node test-hikpartner.js <YOUR_API_SECRET>
 */

const https = require("https");

const appKey = process.argv[2] || process.env.HIK_PARTNER_KEY || "gKGPcL7Pcs";
const secretKey = process.argv[3] || process.env.HIK_PARTNER_SECRET || "";
const baseDomain = "isgp.hik-partner.com";

if (!secretKey) {
  console.log("Usage: node test-hikpartner.js <YOUR_API_KEY> <YOUR_API_SECRET>");
  console.log("Or if your API Key is gKGPcL7Pcs:");
  console.log("  node test-hikpartner.js gKGPcL7Pcs YOUR_API_SECRET");
  process.exit(1);
}

console.log(`Connecting to Hik-Partner Pro OpenAPI (${baseDomain}) ...`);
console.log(`Account (API Key): ${appKey}`);

const postData = JSON.stringify({
  appKey: appKey,
  secretKey: secretKey,
});

const options = {
  hostname: baseDomain,
  port: 443,
  path: "/api/hpcgw/v1/token/get",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => {
    console.log(`HTTP Status: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(body);
      console.log("\nResponse from Hik-Partner Pro:");
      console.log(JSON.stringify(parsed, null, 2));

      if (parsed.code === "200" || parsed.code === 200) {
        console.log("\n SUCCESS! Your Hik-Partner Pro OpenAPI connection is active!");
        console.log(`Access Token: ${parsed.data.accessToken}`);
        console.log(`Area Domain : ${parsed.data.areaDomain}`);
      } else {
        console.log("\n Connection failed. Check your Secret Key.");
      }
    } catch {
      console.log("Raw Response:", body);
    }
  });
});

req.on("error", (e) => {
  console.error("Connection error:", e.message);
});

req.write(postData);
req.end();
