"use client";

import { useEffect, useState } from "react";

type FormState = {
  host: string;
  port: number;
  https: boolean;
  username: string;
  password: string;
  hasPassword: boolean;
  listenerHost: string;
  listenerPort: number;
  listenerProtocol: "HTTP" | "HTTPS";
};

export function SettingsForm() {
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/device")
      .then((response) => response.json())
      .then((data) => {
        setForm({
          host: data.device.host,
          port: data.device.port,
          https: data.device.https,
          username: data.device.username,
          password: "",
          hasPassword: data.device.hasPassword,
          listenerHost: data.listener.host,
          listenerPort: data.listener.port,
          listenerProtocol: data.listener.protocol,
        });
      });
  }, []);

  if (!form) return <div className="card">Loading device settings…</div>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/device", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device: {
          host: form!.host,
          port: Number(form!.port),
          https: form!.https,
          username: form!.username,
          password: form!.password,
        },
        listener: {
          host: form!.listenerHost,
          port: Number(form!.listenerPort),
          protocol: form!.listenerProtocol,
        },
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Could not save settings.");
      return;
    }
    setForm({ ...form!, password: "", hasPassword: data.device.hasPassword });
    setMessage("Saved on this computer. The password stays in data/settings.json and is not shown again.");
  }

  async function run(action: "test" | "listener") {
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action === "listener" ? "listener" : "test" }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "The terminal did not respond.");
      return;
    }
    if (data.info) {
      setMessage(`Connected${data.info.model ? `: ${data.info.model}` : ""}${data.info.deviceName ? ` · ${data.info.deviceName}` : ""}.`);
    } else {
      setMessage(data.message || "Listener updated.");
    }
  }

  return (
    <form className="grid" onSubmit={save}>
      <div className="card stack">
        <h2>Terminal</h2>
        <p className="faint">DS-K1T342MFWX-E1 on the office Wi-Fi. The address in net_if2.xml is 192.168.10.16.</p>
        <label>
          IP address
          <input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} required />
        </label>
        <label>
          Port
          <input type="number" value={form.port} onChange={(event) => setForm({ ...form, port: Number(event.target.value) })} required />
        </label>
        <label className="checks">
          <input type="checkbox" checked={form.https} onChange={(event) => setForm({ ...form, https: event.target.checked })} />
          HTTPS
        </label>
        <label>
          Username
          <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            placeholder={form.hasPassword ? "Saved — enter only to replace" : "Device admin password"}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required={!form.hasPassword}
          />
        </label>
      </div>

      <div className="card stack">
        <h2>Where punches are sent</h2>
        <p className="faint">
          The terminal pushes HTTP/HTTPS events to this address (path: <code>/api/hikEvents</code>). For your cloud server, use <code>attendance.sfkworks.online</code> on port <code>443</code> (HTTPS).
        </p>
        <label>
          This computer&apos;s LAN IP
          <input value={form.listenerHost} onChange={(event) => setForm({ ...form, listenerHost: event.target.value })} required />
        </label>
        <label>
          Port
          <input
            type="number"
            value={form.listenerPort}
            onChange={(event) => setForm({ ...form, listenerPort: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          Protocol
          <select
            value={form.listenerProtocol}
            onChange={(event) => setForm({ ...form, listenerProtocol: event.target.value as "HTTP" | "HTTPS" })}
          >
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
          </select>
        </label>
        {error ? <div className="banner error">{error}</div> : null}
        {message ? <div className="banner">{message}</div> : null}
        <div className="row">
          <button disabled={busy} type="submit">Save</button>
          <button disabled={busy} className="ghost" type="button" onClick={() => void run("test")}>Test connection</button>
          <button disabled={busy} className="ghost" type="button" onClick={() => void run("listener")}>
            Send events here
          </button>
        </div>
      </div>
    </form>
  );
}
