import { Agent, fetch as undiciFetch } from "undici";

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

type TokenCache = {
  accessToken: string;
  areaDomain: string;
  expireTime: number;
};

let cachedToken: TokenCache | null = null;

export class HikPartnerError extends Error {
  code: string | number;
  body: unknown;

  constructor(message: string, code: string | number = "UNKNOWN", body: unknown = null) {
    super(message);
    this.name = "HikPartnerError";
    this.code = code;
    this.body = body;
  }
}

/**
 * Retrieves a valid access token from Hik-Partner Pro OpenAPI.
 * Automatically caches the token until close to expiration (typically 7 days).
 */
export async function getHikPartnerToken({
  appKey,
  secretKey,
  baseDomain = "isgp.hik-partner.com",
}: {
  appKey: string;
  secretKey: string;
  baseDomain?: string;
}): Promise<TokenCache> {
  const now = Date.now();
  if (cachedToken && cachedToken.expireTime - now > 60 * 1000) {
    return cachedToken;
  }

  const url = `https://${baseDomain}/api/hpcgw/v1/token/get`;
  const response = await undiciFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
    dispatcher: insecureAgent,
  });

  const raw = await response.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HikPartnerError(`Hik-Partner returned non-JSON response (${response.status})`, response.status, raw);
  }

  const isSuccess =
    json.errorCode === "0" ||
    json.errorCode === 0 ||
    json.code === "200" ||
    json.code === 200 ||
    json.code === "0" ||
    json.code === 0 ||
    Boolean(json.data?.accessToken);

  if (!isSuccess) {
    throw new HikPartnerError(json.errorMsg || json.msg || `Hik-Partner error: ${json.errorCode || json.code}`, json.errorCode || json.code, json);
  }

  const data = json.data || {};
  cachedToken = {
    accessToken: data.accessToken,
    areaDomain: data.areaDomain || baseDomain,
    expireTime: Number(data.expireTime) || now + 7 * 24 * 3600 * 1000,
  };

  return cachedToken;
}

/**
 * Generic call to Hik-Partner Pro OpenAPI using the retrieved access token.
 */
export async function callHikPartner<T = any>({
  appKey,
  secretKey,
  path,
  method = "POST",
  body = {},
  baseDomain = "isgp.hik-partner.com",
}: {
  appKey: string;
  secretKey: string;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
  baseDomain?: string;
}): Promise<T> {
  const token = await getHikPartnerToken({ appKey, secretKey, baseDomain });
  const targetDomain = token.areaDomain.startsWith("http") ? token.areaDomain : `https://${token.areaDomain}`;
  const url = `${targetDomain}${path}`;

  const response = await undiciFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Token: token.accessToken,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
    dispatcher: insecureAgent,
  });

  const raw = await response.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new HikPartnerError(`Hik-Partner API returned non-JSON response (${response.status})`, response.status, raw);
  }

  if (json.code !== "200" && json.code !== 200 && json.code !== "0" && json.code !== 0) {
    throw new HikPartnerError(json.msg || `Hik-Partner error: ${json.code}`, json.code, json);
  }

  return json as T;
}
