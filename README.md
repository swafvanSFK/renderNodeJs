# Hikvision Event Listener on Render

Lightweight Node.js service to receive and log HTTP Listening / Alarm Host events pushed from Hikvision access control terminals.

## Features
- Handles `POST /api/hikEvents` (multipart form-data & JSON).
- Automatically parses Hikvision `event_log` / `AccessControllerEvent`.
- Extracts Employee PIN, Name, SubEventType (fingerprint/face/card), and Punch Time.
- Built-in live browser dashboard with auto-refresh at `https://<your-service>.onrender.com/`.

---

## Deploying to Render (Free Web Service)

1. **Push to GitHub**:
   ```bash
   cd D:\App\renderNodeJs
   git init
   git add .
   git commit -m "Hikvision Render Listener"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Create Web Service on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** → **Web Service**.
   - Select your GitHub repository.
   - Configure:
     - **Name**: `hik-listener` (or any name)
     - **Region**: Choose closest to you (e.g. Frankfurt or Singapore)
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `node index.js`
     - **Instance Type**: `Free`
   - Click **Deploy Web Service**.

3. **Get your Public URL**:
   - Render will assign a public HTTPS domain:
     `https://hik-listener.onrender.com`

---

## Configuring the Hikvision Terminal

In the Hikvision Web GUI:
1. Go to **Network** → **Network Service** → **HTTP Listening**.
2. Set:
   - **Event Alarm IP/Domain Name**: `hik-listener.onrender.com` *(just the domain without https://)*
   - **URL**: `/api/hikEvents`
   - **Port**: `443`
   - **Protocol**: `HTTPS`
3. Click **Save**.
4. Punch on the device and view live punches in your browser at `https://hik-listener.onrender.com/`.
