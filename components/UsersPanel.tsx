"use client";

import { useEffect, useState } from "react";
import type { Person, PersonInput } from "@/lib/types";

const empty = (): PersonInput => ({
  employeeNo: "",
  name: "",
  userType: "normal",
  gender: "unknown",
  beginTime: toLocalInput(new Date()),
  endTime: "2037-12-31T23:59",
  password: "",
});

export function UsersPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<PersonInput>(empty());
  const [editing, setEditing] = useState(false);
  const [faceName, setFaceName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/users");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load people from the terminal.");
      return;
    }
    setPeople(data.people || []);
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(person: Person) {
    setEditing(true);
    setFaceName("");
    setForm({
      employeeNo: person.employeeNo,
      name: person.name,
      userType: (person.userType as PersonInput["userType"]) || "normal",
      gender: (person.gender as PersonInput["gender"]) || "unknown",
      beginTime: toLocalInput(person.beginTime),
      endTime: toLocalInput(person.endTime) || "2037-12-31T23:59",
      password: "",
    });
  }

  async function onFile(file: File | undefined) {
    setFaceName(file?.name || "");
    if (!file) {
      setForm((current) => ({ ...current, faceBase64: undefined, faceMime: undefined }));
      return;
    }
    if (file.size > 1_500_000) {
      setError("Use a face photo smaller than 1.5 MB. The terminal rejects large images.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const [, base64] = dataUrl.split(",");
    setForm((current) => ({ ...current, faceBase64: base64, faceMime: file.type }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const url = editing ? `/api/users/${encodeURIComponent(form.employeeNo)}` : "/api/users";
    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "The terminal rejected this person.");
      return;
    }
    setNotice(data.faceError ? `Person saved. Face photo was not enrolled: ${data.faceError}` : "Saved on the terminal.");
    setForm(empty());
    setEditing(false);
    setFaceName("");
    await load();
  }

  async function remove(employeeNo: string) {
    if (!window.confirm(`Remove employee ${employeeNo} from the terminal?`)) return;
    setError("");
    const response = await fetch(`/api/users/${encodeURIComponent(employeeNo)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not remove this person.");
      return;
    }
    await load();
  }

  return (
    <div className="grid">
      <form className="card stack" onSubmit={save}>
        <h2>{editing ? "Update person" : "Add person"}</h2>
        <label>
          Employee number
          <input
            value={form.employeeNo}
            required
            disabled={editing}
            onChange={(event) => setForm({ ...form, employeeNo: event.target.value })}
          />
        </label>
        <label>
          Name
          <input value={form.name} required onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          Type
          <select value={form.userType} onChange={(event) => setForm({ ...form, userType: event.target.value as PersonInput["userType"] })}>
            <option value="normal">Employee</option>
            <option value="visitor">Visitor</option>
            <option value="blackList">Blocked</option>
          </select>
        </label>
        <label>
          Gender
          <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as PersonInput["gender"] })}>
            <option value="unknown">Unspecified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label>
          Valid from
          <input type="datetime-local" value={form.beginTime} onChange={(event) => setForm({ ...form, beginTime: event.target.value })} />
        </label>
        <label>
          Valid until
          <input type="datetime-local" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
        </label>
        <label>
          Door password (optional)
          <input
            type="password"
            value={form.password || ""}
            autoComplete="new-password"
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
        </label>
        <label>
          Face photo
          <input type="file" accept="image/jpeg,image/png" onChange={(event) => void onFile(event.target.files?.[0])} />
        </label>
        {faceName ? <div className="faint">{faceName}</div> : null}
        {error ? <div className="banner error">{error}</div> : null}
        {notice ? <div className="banner">{notice}</div> : null}
        <div className="row">
          <button disabled={busy} type="submit">{busy ? "Saving…" : editing ? "Update" : "Add"}</button>
          {editing ? (
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setEditing(false);
                setForm(empty());
                setFaceName("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>On the terminal ({people.length})</h2>
          <button className="ghost" type="button" onClick={() => void load()}>Refresh</button>
        </div>
        {people.length === 0 ? (
          <div className="empty">No people returned. Save the device login on the Device page, then add someone here.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Access</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.employeeNo}>
                  <td className="pin">{person.employeeNo}</td>
                  <td>
                    <div>{person.name || "—"}</div>
                    <div className="faint">
                      {person.userType}
                      {person.numOfFace != null ? ` · faces ${person.numOfFace}` : ""}
                      {person.numOfFP != null ? ` · fingerprints ${person.numOfFP}` : ""}
                    </div>
                  </td>
                  <td className="faint">{person.endTime ? `until ${person.endTime.replace("T", " ").slice(0, 16)}` : "door 1"}</td>
                  <td>
                    <div className="row">
                      <button className="ghost" type="button" onClick={() => edit(person)}>Edit</button>
                      <button className="danger" type="button" onClick={() => void remove(person.employeeNo)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function toLocalInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value.slice(0, 16) : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
