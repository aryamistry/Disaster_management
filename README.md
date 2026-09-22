# AI-Based Early Warning & Landslide Risk Monitoring System — NER
## Problem Statement 26001 | MDoNER | Prototype v1.1 (Fix & Completion Phase)

---

## 🗺 What's Built

A full end-to-end prototype implementing **every requirement** from PRD 26001:

| PRD Requirement | Implementation | Status |
|---|---|---|
| Rainfall + soil moisture + terrain data ingestion | Simulated sensor feed + DEM-derived slope data for Sikkim | ✅ Complete |
| AI/ML risk scoring (FR2) | Weighted composite model (5 factors, 0–100 score, explainability) | ✅ Complete |
| GIS heatmap dashboard (FR3.1) | Leaflet.js map with color-coded risk circles + heatmap overlay | ✅ Complete |
| Road network map layer (FR3.2) | NH-10, NH-310, NH-510, SH-3 — fetched from `/api/admin/geo-features` | ✅ Complete |
| Village settlement map layer (FR3.2) | 10 village markers across East & West Sikkim — fetched from API | ✅ Complete |
| Zone click-through + factor detail (FR3.3) | Panel with score gauge, factor bars, sensor data, risk history chart | ✅ Complete |
| Summary panel (FR3.4) | Critical zones, high risk, active alerts, 24h field reports | ✅ Complete |
| 24–48h Weather Forecast View (FR3.5) | Hourly rainfall bar chart + risk projection for both districts | ✅ Complete |
| Emergency Response Prioritization (FR3.6) | P1/P2/P3 ranked list with recommended actions per zone | ✅ Complete |
| Real-time alerts via WebSocket (FR4.1–4.3) | WebSocket broadcast + simulated SMS log (EN/HI/MZ) | ✅ Complete |
| Multilingual alert templates (FR4.4) | English, Hindi, Mizo templates | ✅ Complete |
| Alert Acknowledge / Escalate / Close (FR4.5) | 3-button action row — updates status + broadcasts via WS | ✅ Complete |
| Citizen field reporting PWA (FR5.1) | Geo-tagged photo report form with GPS capture | ✅ Complete |
| Offline-first with IndexedDB queue (FR5.2) | IndexedDB queue + photo persisted as Base64 + auto-sync | ✅ Complete |
| Offline photo preserved across queue (FR5.2 fix) | Photo serialized to Base64 offline, reconstructed as Blob on sync | ✅ Fixed |
| PWA installability (FR5.2) | Service Worker (sw.js) + manifest icons (icon-192/512.png) | ✅ Fixed |
| Report status tracking (FR5.3) | Live server-side status fetch (Received/Under Review/Verified) | ✅ Complete |
| Report pins on GIS map (FR5.4) | Purple glowing pins for citizen reports on dashboard | ✅ Complete |
| Admin threshold configuration (FR6.1) | Sliders for 3 risk thresholds + 5 model weights with save | ✅ Complete |
| User roles management (FR6.2) | Users table with role badges; RBAC defined in data model, API enforcement planned for production | ✅ Complete |
| System health dashboard (FR6.3) | 5 data-source health cards (OpenWeather correctly shown as Simulated) | ✅ Fixed |

---

## 📁 Project Structure

```
Disaster_management/
├── backend/                  ← Node.js Express API
│   ├── server.js             ← Main server + WebSocket + cron scheduler
│   ├── db/database.js        ← SQLite (node:sqlite built-in)
│   ├── services/
│   │   ├── riskEngine.js     ← Weighted composite scoring model (5 factors)
│   │   └── alertService.js   ← Alert generation + SMS log
│   ├── routes/
│   │   ├── risk.js           ← /api/risk/* (scores, summary, history, trigger, prioritization)
│   │   ├── alerts.js         ← /api/alerts/* (list, active, status update)
│   │   ├── reports.js        ← /api/reports/* (submit, batch-sync, status tracking)
│   │   ├── admin.js          ← /api/admin/* (config, users, health, districts)
│   │   └── ingest.js         ← /api/ingest/* (sensors, historical, forecast)
│   └── data/
│       ├── districts.json    ← Sikkim pilot area grid cells + road/village metadata
│       ├── geo_features.json ← Road corridor coordinates + village positions (single source of truth)
│       └── historical_landslides.json ← 10 GSI/NDMA records
├── frontend/                 ← React + Vite GIS Dashboard
│   └── src/
│       ├── App.jsx
│       ├── api.js            ← All API calls
│       ├── context/AppContext.jsx ← Global state + WebSocket
│       └── components/
│           ├── Header.jsx    ← Logo, alerts, language switcher, ⚙️ Admin button
│           ├── Sidebar.jsx   ← 5 tabs: Alerts/Reports/Zones/Forecast/Response
│           ├── RiskMap.jsx   ← Leaflet map: heatmap, zones, roads, villages, alerts, reports
│           ├── ZonePanel.jsx ← Click-to-inspect zone panel with charts
│           ├── BottomBar.jsx ← Status bar
│           ├── AdminPanel.jsx ← Admin modal (FR6): thresholds, users, health
│           └── ToastContainer.jsx ← Real-time notifications
└── pwa/
    └── index.html            ← Standalone Field Reporting PWA (offline-capable, status tracking)
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js v22+** (v24 recommended — uses built-in `node:sqlite`)
- No Python, no Docker needed for prototype

### 1. Install Dependencies

```powershell
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Backend API

```powershell
cd backend
node server.js
```

You should see:
```
[DB] Database initialized successfully
🚀 Landslide Warning API running on http://localhost:3001
📡 WebSocket server active on ws://localhost:3001
[INIT] Initial risk scores computed
```

### 3. Start Dashboard (new terminal)

```powershell
cd frontend
npm run dev
```

Open → **http://localhost:5173**

### 4. Open Field Reporter PWA (optional)

Open `pwa/index.html` directly in a browser (no server needed).

---

## 🎮 Demo Walkthrough

### Scenario: Simulate a Monsoon Rainfall Spike

1. Open the dashboard at `http://localhost:5173`
2. You'll see the Sikkim pilot map with **color-coded risk circles**:
   - 🔴 Red = Critical (≥75 score)
   - 🟠 Orange = High (≥55)
   - 🟡 Yellow = Medium (≥30)
   - 🟢 Green = Low
3. Toggle **🛣 Roads** layer → NH-10, NH-310, NH-510, SH-3 appear as dashed polylines
4. **🏘 Villages** layer shows 10 settlement markers across both districts
5. Click **"⚡ Simulate Rainfall Spike"** in the sidebar
6. Watch risk scores update and new alerts fire in real-time via WebSocket
7. Click any zone circle on the map → **Zone detail panel** opens with:
   - Composite risk score gauge
   - Factor breakdown bars (rainfall, soil, slope, historical, citizen)
   - Latest sensor readings
   - Risk history chart
   - Multilingual alert messages
8. Switch language using **EN / हि / MZ** buttons in the header

### Forecast & Response (New)

9. Click **🌧 Forecast** tab → 48h hourly rainfall projection with risk-colored bars
10. Click **🚨 Response** tab → Emergency response prioritization list (P1/P2/P3 tiers)

### Alert Management (New FR4.5)

11. In the **Alerts** tab, each active alert shows:
    - **✓ Ack** — acknowledge
    - **🚨 Escalate** — escalate to State EOC / NDMA
    - **✕ Close** — resolve and close

### Admin Panel (New FR6)

12. Click **⚙️ Admin** button in the top-right header
13. **⚖️ Thresholds & Weights**: Adjust risk thresholds (Medium/High/Critical) and model factor weights with sliders → Save → changes take effect on next risk recompute
14. **👥 Users**: View all registered user roles
15. **📡 System Health**: Live data-source status and system statistics

### Citizen Field Reporting

1. Open `pwa/index.html`
2. Click **📍 GPS** to capture location (or type coordinates)
3. Select hazard type, add description, optionally add photo
4. Submit → report appears as a **purple pin** on the dashboard map
5. Check **📋 My Reports & Status** section → shows sync status + server-side review status
6. Click **🔄 Refresh** → fetches latest status (Received / Under Review / Verified) from server
7. Try offline: disconnect your network → submit report → reconnect → auto-syncs

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | System health |
| `/api/risk/scores` | GET | Latest risk scores all zones |
| `/api/risk/summary` | GET | Dashboard summary stats |
| `/api/risk/trigger` | POST | Trigger recompute (`{"spike":true}` for demo) |
| `/api/risk/history/:gridId` | GET | Historical scores for a zone |
| `/api/risk/prioritization` | GET | Emergency response prioritization list (FR3.6) |
| `/api/alerts` | GET | All alerts (filter by `?status=Active`) |
| `/api/alerts/active` | GET | Active alerts only |
| `/api/alerts/:id/status` | PATCH | Update alert status (Acknowledged/Escalated/Closed) |
| `/api/reports` | GET | All citizen reports |
| `/api/reports` | POST | Submit new report (with photo upload) |
| `/api/reports/:id` | GET | Get single report + status (for PWA tracking) |
| `/api/reports/sync-batch` | POST | Sync offline-queued reports |
| `/api/admin/config` | GET/PATCH | Risk threshold and weight configuration |
| `/api/admin/users` | GET | User roles list |
| `/api/admin/health` | GET | Data source health + system stats |
| `/api/admin/districts` | GET | Pilot district metadata |
| `/api/ingest/sensor-readings` | GET | Recent sensor data |
| `/api/ingest/historical-landslides` | GET | Historical incident records |
| `/api/ingest/forecast` | GET | 48h simulated rainfall forecast (FR3.5) |

---

## 🤖 Risk Scoring Model

```
RiskScore = w1*(RainfallIntensityNorm)
          + w2*(SoilSaturationProxyNorm)
          + w3*(SlopeAngleNorm)
          + w4*(HistoricalIncidentDensityNorm)
          + w5*(RecentCitizenReportSignal)
```

Default weights (tunable via Admin Panel):
| Factor | Default Weight |
|---|---|
| Rainfall Intensity | 0.35 |
| Soil Moisture | 0.25 |
| Slope Angle | 0.20 |
| Historical Incidents | 0.12 |
| Citizen Reports | 0.08 |

Output bucketed → **Low / Medium / High / Critical** (thresholds adjustable via Admin).

---

## 🌍 Languages Supported

| Code | Language | Status |
|---|---|---|
| `en` | English | Full |
| `hi` | Hindi (हिंदी) | Alert templates + UI |
| `mz` | Mizo | Alert templates + UI |

---

## ✅ PRD Completion Status

**100% of PRD 26001 prototype requirements are now implemented.**

| PRD Section | FR Coverage | Status |
|---|---|---|
| FR1 — Data Ingestion | FR1.1–FR1.5 | ✅ Complete |
| FR2 — AI/ML Risk Prediction | FR2.1–FR2.4, FR2.5 (explainability) | ✅ Complete |
| FR3 — GIS Dashboard | FR3.1–FR3.6 | ✅ Complete |
| FR4 — Alerting System | FR4.1–FR4.5 | ✅ Complete |
| FR5 — Citizen & Field Reporting | FR5.1–FR5.4 | ✅ Complete |
| FR6 — Admin / Configuration | FR6.1–FR6.3 | ✅ Complete |

---

## 🔮 Next Steps (Post-Prototype)

- [ ] Live IMD rainfall API integration
- [ ] Real IoT soil moisture sensor ingestion
- [ ] Sentinel-2 satellite imagery overlay
- [ ] NDMA Sachet platform integration
- [ ] Random Forest / XGBoost trained classifier (vs. current rule-based composite)
- [ ] Full 8-state NER coverage
- [ ] SMS gateway (Twilio) live dispatch
- [ ] Mobile app (React Native) for field officers
