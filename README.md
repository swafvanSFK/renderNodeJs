# Hikvision attendance (Next.js)

Live attendance and people management for a **Hikvision DS-K1T342MFWX-E1** (face, fingerprint, and card).

The terminal pushes each authentication to this app. The People page adds, updates, and removes users on the terminal through ISAPI.

## Run it on the office LAN

People management calls the terminal at its private address (`192.168.10.16` in `net_if2.xml`). That only works from a computer on the same network. `test_local.xml` already points event pushes at `192.168.10.52` port `3050`.

```bash
cd D:\App\renderNodeJs
npm install
npm run dev
```

Open `http://localhost:3050`.

1. **Device** — enter the terminal IP (`192.168.10.16`), port `80`, and the admin username and password. Save, then **Test connection**.
2. **Send events here** — writes HTTP listening host 1 on the terminal (`/api/hikEvents` on this PC). Or set the same values in the terminal web page: Network → Network Service → HTTP Listening.
3. **People** — add a person (employee number, name, optional face photo), update them, or remove them.
4. **Live** — authenticate on the terminal. The punch shows up immediately.

Punches are stored in `data/attendance.json`. The device password is stored in `data/settings.json`. Both stay on this computer.

The listener accepts the JSON events this app asks the terminal to send, and the XML events from the existing `test_local.xml` configuration.

## Render

A Render web service can receive punches if the terminal can reach the public URL, but it cannot manage users on `192.168.10.16`.

- Build command: `npm install && npm run build`
- Start command: `npm start`
- HTTP Listening: host `your-service.onrender.com`, URL `/api/hikEvents`, port `443`, protocol HTTPS

## Terminal calls used

| Action | ISAPI |
| --- | --- |
| List people | `POST /ISAPI/AccessControl/UserInfo/Search?format=json` |
| Add | `POST /ISAPI/AccessControl/UserInfo/Record?format=json` |
| Update | `PUT /ISAPI/AccessControl/UserInfo/Modify?format=json` |
| Remove | `PUT /ISAPI/AccessControl/UserInfoDetail/Delete?format=json` |
| Face photo | `POST /ISAPI/Intelligent/FDLib/FaceDataRecord?format=json` |
| Event target | `PUT /ISAPI/Event/notification/httpHosts/1` |
| Incoming punches | `POST /api/hikEvents` |
