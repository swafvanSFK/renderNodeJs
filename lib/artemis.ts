import crypto from "crypto";
import { Agent, fetch as undiciFetch } from "undici";
import type { ArtemisConfig } from "./types";

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

export class ArtemisError extends Error {
  code: string | number;
  body: unknown;

  constructor(message: string, code: string | number = "UNKNOWN", body: unknown = null) {
    super(message);
    this.name = "ArtemisError";
    this.code = code;
    this.body = body;
  }
}

/**
 * Builds the headers and HMAC-SHA256 signature required by HikCentral / Artemis OpenAPI.
 * As documented in HikCentral OpenAPI manual "Signature and Authentication":
 * StringToSign = HTTP_METHOD + "\n" + Accept + "\n" + Content-MD5 + "\n" + Content-Type + "\n" + Date + "\n" + Headers + Uri
 */
export function buildArtemisHeaders({
  appKey,
  appSecret,
  method,
  path,
  body,
  customHeaders = {},
}: {
  appKey: string;
  appSecret: string;
  method: string;
  path: string;
  body?: string;
  customHeaders?: Record<string, string>;
}) {
  const upperMethod = method.toUpperCase();
  const accept = "*/*";
  const contentType = "application/json";

  // Content-MD5 is Base64(MD5(body)) if body exists
  let contentMd5 = "";
  if (body && body.length > 0) {
    contentMd5 = crypto.createHash("md5").update(body, "utf8").digest("base64");
  }

  const timestamp = Date.now().toString();

  // Signature headers to include (must be sorted alphabetically by lower-case key)
  const headersToSign: Record<string, string> = {
    "x-ca-key": appKey,
    "x-ca-timestamp": timestamp,
    ...customHeaders,
  };

  const sortedKeys = Object.keys(headersToSign).sort();
  const signatureHeadersList = sortedKeys.join(",");

  let signedHeadersBlock = "";
  for (const k of sortedKeys) {
    signedHeadersBlock += `${k.toLowerCase()}:${headersToSign[k]}\n`;
  }

  // StringToSign:
  // Method\nAccept\nContent-MD5\nContent-Type\nDate\nHeadersUri
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
    "X-Ca-Signature-Headers": signatureHeadersList,
    "X-Ca-Signature": signature,
  };
}

/**
 * Makes an HTTPS request to HikCentral Professional OpenAPI
 */
export async function callArtemis<T = Record<string, unknown>>({
  config,
  path,
  method = "POST",
  body,
}: {
  config: ArtemisConfig;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const protocol = config.https ? "https" : "http";
  const url = `${protocol}://${config.host}:${config.port}${path}`;
  const bodyStr = body ? JSON.stringify(body) : undefined;

  const headers = buildArtemisHeaders({
    appKey: config.appKey,
    appSecret: config.appSecret,
    method,
    path,
    body: bodyStr,
  });

  const response = await undiciFetch(url, {
    method,
    headers,
    body: bodyStr,
    dispatcher: insecureAgent,
  });

  const rawText = await response.text();
  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new ArtemisError(`HikCentral returned non-JSON response (${response.status})`, response.status, rawText);
  }

  // HikCentral returns code: "0" or 0 on success
  if (json.code !== "0" && json.code !== 0) {
    throw new ArtemisError(json.msg || `HikCentral error code: ${json.code}`, json.code, json);
  }

  return json as T;
}

/**
 * Subscribes your HTTPS listener endpoint to HikCentral access control events.
 * Event types default to:
 * 196893: Access Control Card Swipe / Authentication
 */
export async function subscribeHikCentralEvents({
  config,
  eventDest,
  eventTypes = [196893],
  token,
}: {
  config: ArtemisConfig;
  eventDest: string;
  eventTypes?: number[];
  token?: string;
}) {
  return callArtemis({
    config,
    path: "/artemis/api/eventService/v1/eventSubscriptionByEventTypes",
    method: "POST",
    body: {
      eventTypes,
      eventDest,
      ...(token ? { token } : {}),
    },
  });
}

/**
 * Queries currently active event subscriptions on HikCentral
 */
export async function queryHikCentralSubscriptions(config: ArtemisConfig) {
  return callArtemis({
    config,
    path: "/artemis/api/eventService/v1/eventSubscriptionView",
    method: "POST",
    body: {},
  });
}

/**
 * Unsubscribes from specific event types on HikCentral
 */
export async function unsubscribeHikCentralEvents({
  config,
  eventTypes = [196893],
}: {
  config: ArtemisConfig;
  eventTypes?: number[];
}) {
  return callArtemis({
    config,
    path: "/artemis/api/eventService/v1/eventUnSubscriptionByEventTypes",
    method: "POST",
    body: { eventTypes },
  });
}
