"use client";

import { useEffect, useState } from "react";
import type { Punch } from "@/lib/types";

export function AttendanceLive() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [connected, setConnected] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/attendance/stream");
    source.addEventListener("snapshot", (event) => {
      setPunches(JSON.parse((event as MessageEvent).data) as Punch[]);
      setConnected(true);
    });
    source.addEventListener("punch", (event) => {
      const punch = JSON.parse((event as MessageEvent).data) as Punch;
      setPunches((current) => [punch, ...current.filter((item) => item.id !== punch.id)].slice(0, 300));
      setFreshId(punch.id);
      setConnected(true);
    });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  const today = new Date().toDateString();
  const todayCount = punches.filter((punch) => {
    const when = punch.punchTime || punch.receivedAt;
    const parsed = new Date(when);
    return Number.isNaN(parsed.getTime()) ? false : parsed.toDateString() === today;
  }).length;

  async function clearFeed() {
    await fetch("/api/attendance", { method: "DELETE" });
    setPunches([]);
  }

  return (
    <>
      <div className="banner">
        The terminal pushes each authentication directly to <code>/api/hikEvents</code> over HTTPS. This page updates the moment a punch arrives.
      </div>
      <div className="stats">
        <div className="card stat">
          <span className="faint">Today</span>
          <strong>{todayCount}</strong>
        </div>
        <div className="card stat">
          <span className="faint">Stored</span>
          <strong>{punches.length}</strong>
        </div>
        <div className="card stat">
          <span className={connected ? "live" : "live"} style={{ color: connected ? undefined : "#f87171" }}>
            <span className={connected ? "dot" : "dot off"} />
            {connected ? "Listening" : "Reconnecting"}
          </span>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2>Attendance</h2>
          <button className="ghost" onClick={clearFeed} type="button">Clear feed</button>
        </div>
        {punches.length === 0 ? (
          <div className="empty">No punches yet. Authenticate on the terminal to see a live record here.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Person</th>
                <th>Method</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {punches.map((punch) => (
                <tr key={punch.id} className={punch.id === freshId ? "fresh" : ""}>
                  <td>{punch.photoUrl ? <img className="shot" alt="" src={punch.photoUrl} /> : null}</td>
                  <td>
                    <div>{punch.name}</div>
                    <div className="pin">{punch.pin}</div>
                  </td>
                  <td>
                    <div>{punch.label}</div>
                    <div className="faint">{punch.deviceIp}</div>
                  </td>
                  <td>{formatTime(punch.punchTime || punch.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toLocaleString();
}
