import crypto from "crypto";
import { Agent, fetch as undiciFetch } from "undici";
import { getSettings } from "./device-config";
import type { Person, PersonInput } from "./types";

const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

type Json = Record<string, unknown>;

export class DeviceError extends Error {
  status: number;
  body: string;

  constructor(message: string, status = 0, body = "") {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function testDevice() {
  const data = await isapi("GET", "/ISAPI/System/deviceInfo?format=json");
  const info = (data.DeviceInfo || data) as Json;
  return {
    deviceName: str(info.deviceName),
    model: str(info.model),
    firmware: str(info.firmwareVersion) || str(info.firmwareReleasedDate),
    serial: str(info.serialNumber),
    mac: str(info.macAddress),
  };
}

export async function listPeople(): Promise<Person[]> {
  const searchID = crypto.randomUUID();
  const people: Person[] = [];
  let position = 0;

  for (let page = 0; page < 40; page += 1) {
    const data = await isapi("POST", "/ISAPI/AccessControl/UserInfo/Search?format=json", {
      json: {
        UserInfoSearchCond: {
          searchID,
          searchResultPosition: position,
          maxResults: 30,
        },
      },
    });
    const search = (data.UserInfoSearch || {}) as Json;
    const rows = asArray(search.UserInfo);
    for (const row of rows) people.push(toPerson(row));
    const status = str(search.responseStatusStrg);
    if (status !== "MORE") break;
    position += rows.length || 30;
  }

  return people;
}

export async function addPerson(input: PersonInput) {
  await isapi("POST", "/ISAPI/AccessControl/UserInfo/Record?format=json", {
    json: { UserInfo: userInfo(input, true) },
  });
  const faceError = await uploadFace(input);
  return { faceError };
}

export async function updatePerson(employeeNo: string, input: PersonInput) {
  await isapi("PUT", "/ISAPI/AccessControl/UserInfo/Modify?format=json", {
    json: { UserInfo: userInfo({ ...input, employeeNo }, false) },
  });
  let faceError: string | null = null;
  if (input.faceBase64) {
    await removeFace(employeeNo);
    faceError = await uploadFace({ ...input, employeeNo });
  }
  return { faceError };
}

export async function removePerson(employeeNo: string) {
  await removeFace(employeeNo);
  await isapi("PUT", "/ISAPI/AccessControl/UserInfoDetail/Delete?format=json", {
    json: {
      UserInfoDetail: {
        mode: "byEmployeeNo",
        EmployeeNoList: [{ employeeNo }],
      },
    },
  });

  for (let i = 0; i < 12; i += 1) {
    const data = await isapi("GET", "/ISAPI/AccessControl/UserInfoDetail/DeleteProcess?format=json");
    const status = str((data.UserInfoDetailDeleteProcess as Json | undefined)?.status);
    if (status === "success") return;
    if (status === "failed") throw new DeviceError("The terminal failed to delete this person.");
    await sleep(400);
  }
}

export async function pointListener(listener: { host: string; port: number; protocol: "HTTP" | "HTTPS" }) {
  const isIp = /^[\d.]+$/.test(listener.host.trim());
  const hostXml = isIp
    ? `<addressingFormatType>ipaddress</addressingFormatType>\n<ipAddress>${escapeXml(listener.host.trim())}</ipAddress>`
    : `<addressingFormatType>hostname</addressingFormatType>\n<hostName>${escapeXml(listener.host.trim())}</hostName>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<id>1</id>
<url>/api/hikEvents</url>
<protocolType>${listener.protocol}</protocolType>
<parameterFormatType>JSON</parameterFormatType>
${hostXml}
<portNo>${listener.port}</portNo>
<httpAuthenticationMethod>none</httpAuthenticationMethod>
</HttpHostNotification>`;

  await isapi("PUT", "/ISAPI/Event/notification/httpHosts/1", {
    body: Buffer.from(xml),
    contentType: "application/xml",
  });
}

function userInfo(input: PersonInput, creating: boolean) {
  const info: Json = {
    employeeNo: input.employeeNo,
    name: input.name,
    userType: input.userType || "normal",
    gender: input.gender || "unknown",
    doorRight: "1",
    RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    Valid: {
      enable: true,
      beginTime: toDeviceTime(input.beginTime),
      endTime: toDeviceTime(input.endTime),
      timeType: "local",
    },
  };
  if (creating) info.checkUser = true;
  if (input.password) info.password = input.password;
  return info;
}

async function uploadFace(input: PersonInput) {
  if (!input.faceBase64) return null;
  try {
    const image = Buffer.from(input.faceBase64, "base64");
    const meta = {
      faceLibType: "blackFD",
      FDID: "1",
      FPID: input.employeeNo,
      name: input.name,
      gender: input.gender || "unknown",
      bornTime: "1990-01-01",
      faceType: "normalFace",
    };
    const boundary = `----HikFace${crypto.randomBytes(8).toString("hex")}`;
    const mime = input.faceMime === "image/png" ? "image/png" : "image/jpeg";
    const filename = mime === "image/png" ? "face.png" : "face.jpg";
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="FaceImage"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    await isapi("POST", "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", {
      body: Buffer.concat([head, image, tail]),
      contentType: `multipart/form-data; boundary=${boundary}`,
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Face photo was rejected by the terminal.";
  }
}

async function removeFace(employeeNo: string) {
  try {
    await isapi("PUT", "/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=1&faceLibType=blackFD", {
      json: { FPID: [{ value: employeeNo }] },
    });
  } catch {
    // A person may have no enrolled face. Deletion of the person record still proceeds.
  }
}

async function isapi(
  method: string,
  path: string,
  options: { json?: unknown; body?: Buffer; contentType?: string } = {},
) {
  const { device } = getSettings();
  if (!device.host || !device.username || !device.password) {
    throw new DeviceError("Open Device and save the terminal IP, username, and password.");
  }

  const body = options.body ?? (options.json != null ? Buffer.from(JSON.stringify(options.json)) : undefined);
  const contentType = options.contentType ?? (options.json != null ? "application/json" : undefined);
  const url = `${device.https ? "https" : "http"}://${device.host}:${device.port}${path}`;

  let response = await send(device.https, method, url, body, contentType);
  if (response.status === 401) {
    const challenge = response.headers.get("www-authenticate") || "";
    if (/^digest/i.test(challenge)) {
      const authorization = digestHeader(method, path, device.username, device.password, challenge);
      response = await send(device.https, method, url, body, contentType, authorization);
    } else if (/^basic/i.test(challenge)) {
      const token = Buffer.from(`${device.username}:${device.password}`).toString("base64");
      response = await send(device.https, method, url, body, contentType, `Basic ${token}`);
    }
  }

  const text = Buffer.from(await response.arrayBuffer()).toString("utf8");
  if (response.status === 401) {
    throw new DeviceError("The terminal rejected the username or password.", 401, text);
  }
  if (response.status >= 400) {
    throw new DeviceError(messageFrom(text) || `Terminal returned HTTP ${response.status}.`, response.status, text);
  }

  const data = parseBody(text);
  if (typeof data.statusCode === "number" && data.statusCode !== 1 && data.statusCode !== 0) {
    throw new DeviceError(messageFrom(text) || "The terminal rejected the request.", response.status, text);
  }
  return data;
}

async function send(
  https: boolean,
  method: string,
  url: string,
  body: Buffer | undefined,
  contentType?: string,
  authorization?: string,
) {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (authorization) headers.Authorization = authorization;
  if (body) headers["Content-Length"] = String(body.length);

  return undiciFetch(url, {
    method,
    headers,
    body,
    dispatcher: https ? insecureAgent : undefined,
    signal: AbortSignal.timeout(20000),
  });
}

function digestHeader(method: string, uri: string, username: string, password: string, header: string) {
  const realm = pick(header, "realm");
  const nonce = pick(header, "nonce");
  const opaque = pick(header, "opaque");
  const qop = (pick(header, "qop") || "").split(",")[0].trim();
  const algorithm = (pick(header, "algorithm") || "MD5").toUpperCase();
  const hashName = algorithm.includes("SHA-256") ? "sha256" : "md5";
  const hash = (value: string) => crypto.createHash(hashName).update(value).digest("hex");
  const ha1 = hash(`${username}:${realm}:${password}`);
  const ha2 = hash(`${method}:${uri}`);
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const response = qop
    ? hash(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : hash(`${ha1}:${nonce}:${ha2}`);

  const parts = [
    `Digest username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `algorithm=${algorithm}`,
    `response="${response}"`,
  ];
  if (opaque) parts.push(`opaque="${opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  return parts.join(", ");
}

function pick(header: string, name: string) {
  const match = header.match(new RegExp(`${name}=(?:"([^"]+)"|([^,\\s]+))`, "i"));
  return match?.[1] || match?.[2] || "";
}

function parseBody(text: string): Json {
  const trimmed = text.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("<")) return { rawXml: trimmed };
  try {
    return JSON.parse(trimmed) as Json;
  } catch {
    return { raw: trimmed };
  }
}

function messageFrom(text: string) {
  try {
    const data = JSON.parse(text) as Json;
    return str(data.errorMsg) || str(data.statusString) || str(data.subStatusCode);
  } catch {
    const status = text.match(/<statusString>([^<]+)<\/statusString>/i)?.[1];
    const sub = text.match(/<subStatusCode>([^<]+)<\/subStatusCode>/i)?.[1];
    return status && status.toLowerCase() !== "ok" ? status : sub || "";
  }
}

function toPerson(row: Json): Person {
  const valid = (row.Valid || {}) as Json;
  return {
    employeeNo: str(row.employeeNo),
    name: str(row.name),
    userType: str(row.userType) || "normal",
    gender: str(row.gender) || "unknown",
    doorRight: str(row.doorRight),
    beginTime: str(valid.beginTime),
    endTime: str(valid.endTime),
    numOfFace: typeof row.numOfFace === "number" ? row.numOfFace : null,
    numOfFP: typeof row.numOfFP === "number" ? row.numOfFP : null,
    numOfCard: typeof row.numOfCard === "number" ? row.numOfCard : null,
  };
}

function asArray(value: unknown): Json[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return [value];
  return [];
}

function isRecord(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDeviceTime(value: string) {
  const trimmed = value.trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed.slice(0, 19);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
