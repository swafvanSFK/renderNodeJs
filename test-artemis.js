/**
 * Test script for HikCentral OpenAPI (Artemis)
 * Usage:
 *   node test-artemis.js <HIKCENTRAL_HOST> <APP_KEY> <APP_SECRET> <HTTPS_EVENT_DEST>
 * Example:
 *   node test-artemis.js 192.168.10.100 21234567 secretKey123 https://my-service.onrender.com/api/hikEvents
 */

const crypto = require("crypto");
const https = require("https");
const http = require("http");

const host = process.argv[2] || process.env.ARTEMIS_HOST || "192.168.10.100";
const appKey = process.argv[3] || process.env.ARTEMIS_APP_KEY || "your_app_key";
const appSecret = process.argv[4] || process.env.ARTEMIS_APP_SECRET || "your_app_secret";
const eventDest = process.argv[5] || process.env.EVENT_DEST || "https://your-service.onrender.com/api/hikEvents";
const port = 443;

function buildHeaders(method, path, bodyStr) {
  const upperMethod = method.toUpperCase();
  const accept = "*/*";
  const contentType = "application/json";

  let contentMd5 = "";
  if (bodyStr && bodyStr.length > 0) {
    contentMd5 = crypto.createHash("md5").update(bodyStr, "utf8").digest("base64");
  }

  const timestamp = Date.now().toString();
  const headersToSign = {
    "x-ca-key": appKey,
    "x-ca-timestamp": timestamp,
  };

  const sortedKeys = Object.keys(headersToSign).sort();
  const signatureHeaders = sortedKeys.join(",");

  let signedHeadersBlock = "";
  for (const k of sortedKeys) {
    signedHeadersBlock += `${k.toLowerCase()}:${headersToSign[k]}\n`;
  }

  // StringToSign = Method\nAccept\nContent-MD5\nContent-Type\nDate\nHeadersUri
  const stringToSign = `${upperMethod}\n${accept}\n${contentMd5}\n${contentType}\n\n${signedHeadersBlock}${path}`;

  const signature = crypto
    .createHmac("sha256", appSecret)
    .update(stringToSign, "utf8")
    .digest("base64");

  return {
    Accept: accept,
    "Content-Type": contentType,
    ...(contentMd5 ? { "Content-MD5": contentMd5 } : {}),
    "X-Ca-Key": appKey,
    "X-Ca-Timestamp": timestamp,
    "X-Ca-Signature-Headers": signatureHeaders,
    "X-Ca-Signature": signature,
  };
}

async function subscribe() {
  console.log(`Connecting to HikCentral at https://${host}:${port} ...`);
  console.log(`Event destination callback: ${eventDest}`);

  const path = "/artemis/api/eventService/v1/eventSubscriptionByEventTypes";
  const body = JSON.stringify({
    eventTypes: [196893], // Access Control Card Swipe / Authentication
    eventDest: eventDest,
  });

  const headers = buildHeaders("POST", path, body);

  const req = https.request(
    {
      hostname: host,
      port: port,
      path: path,
      method: "POST",
      headers: headers,
      rejectUnauthorized: false, // In case HikCentral uses self-signed certificate
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log(`Status Code: ${res.statusCode}`);
        try {
          console.log("Response:", JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log("Raw Response:", data);
        }
      });
    }
  );

  req.on("error", (err) => {
    console.error("Connection error:", err.message);
  });

  req.write(body);
  req.end();
}

subscribe();
