# Product Requirements Document (PRD)

## AI-Based Landslide & Flash Flood Early Warning System — Hilly States of India

**Problem Statement ID:** 26192
**Organization / Department:** Ministry of Home Affairs
**Category:** Software
**Theme:** Disaster Management
**Document Owner:** Briyona Sanghvi
**Version:** 1.0 (Prototype / Hackathon Scope)
**Status:** Draft

> **Note:** This PRD defines DHARA AI (Dynamic Hazard Assessment & Risk Alerts), a generalized evolution of the earlier prototype, aligned to PSID 26192's problem statement: hyper-local landslide and flash-flood prediction across hilly areas. The current Sikkim dataset is a reference pilot; the architecture is designed to generalize to any hilly state.

---

## 1. Executive Summary

Hilly areas across India face recurring landslides and flash floods that often strike with very short warning times, driven by intense rainfall, fragile geology, unplanned hill cutting, and saturated slopes. These sudden events cause significant loss of life and property, and today's early warning mechanisms are too coarse and reactive to support hyper-local prediction and timely evacuation.

This PRD defines a **prototype** for an AI-powered predictive system that integrates rainfall data, soil moisture sensors, slope stability models, historical landslide/flood inventories, and real-time IoT inputs to generate **hyper-local forecasts at the village or ward level** — giving authorities and communities sufficient lead time for evacuation and risk mitigation. Forecasts and alerts are delivered in real time, multilingual, low-bandwidth-friendly form to district administrations, disaster management authorities, and citizens, visualized on a GIS-based risk dashboard.

**Prototype goal:** Demonstrate an end-to-end working slice — multi-source data ingestion → composite risk scoring → village/ward-level GIS dashboard → hyper-local alert dispatch → citizen/field reporting — for a limited pilot area (1–2 districts, e.g., parts of Mizoram or Sikkim, known landslide and flash-flood hotspots), using a mix of live/public APIs and simulated IoT sensor data where real hardware isn't available.

---

## 2. Problem Statement

### 2.1 Background
- Hilly states in India are highly vulnerable to landslides and flash floods, which often occur with very short warning times, resulting in significant loss of lives and property.
- Hilly terrain and monsoon intensity create recurring landslides, flash floods, road blockages, and slope failures that disrupt connectivity and delay rescue operations.
- Current early warning mechanisms are inadequate for **hyper-local** prediction — they operate at a coarse regional/district level rather than the village or ward level where evacuation decisions actually need to be made.
- Monitoring today relies largely on manual field reporting after the fact rather than predictive, real-time systems, and there is no unified platform combining rainfall, soil moisture, slope stability, historical disaster inventories, and IoT sensor data with AI to proactively flag high-risk zones before failure occurs.

### 2.2 Core Problem
Authorities and communities lack a **real-time, predictive, hyper-local (village/ward-level) early-warning system** — one that fuses rainfall, soil moisture, slope stability, historical landslide/flood data, and IoT sensor inputs, and that remains accessible in low-connectivity remote areas — to provide sufficient lead time for evacuation and disaster preparedness.

### 2.3 Who Is Affected
- **District Disaster Management Authorities (DDMAs)** — need actionable, prioritized risk data.
- **State Disaster Management Authorities (SDMAs) / NDMA** — need regional oversight and reporting.
- **Local communities & villages** — need timely, understandable alerts in local languages.
- **Field officials (PWD, Border Roads Organisation, police, revenue dept.)** — need a way to report ground conditions instantly.
- **Emergency responders** — need prioritized road/connectivity status to plan response routes.

---

## 3. Goals & Objectives

### 3.1 Prototype Objectives (Hackathon Scope)
1. Ingest and fuse at least 4 real/simulated data sources — rainfall, soil moisture (IoT), slope stability/terrain, and historical landslide/flood inventories — into a unified risk model.
2. Compute a landslide/flash-flood risk score at **village/ward-level grid granularity** (not just district level) using a simple ML/rule-based model.
3. Visualize risk as a color-coded heatmap on an interactive GIS map, zoomable to village/ward boundaries.
4. Trigger a simulated multi-channel, hyper-local alert (in-app + SMS-simulated) when risk crosses a threshold, with enough lead time to demonstrate evacuation-window value.
5. Provide a citizen/field-officer mobile-web form to upload a geo-tagged photo report of cracks/slope movement/rising water, with offline queuing, feeding back into the real-time IoT input stream.
6. Show a dashboard summarizing risk severity, affected villages/wards/roads, lead-time-to-event estimate, and weather-linked forecast for the pilot district.

### 3.2 Long-Term Vision (Post-Prototype)
- Coverage across multiple hilly states with live IMD/Bhuvan/Sentinel satellite integration.
- IoT sensor network deployment (soil moisture, tiltmeters, piezometers) on identified critical slopes.
- Integration with NDMA's Sachet platform and state emergency operations centers (EOCs) for official alert dispatch.
- Predictive model retraining pipeline using confirmed incident outcomes (feedback loop).

### 3.3 Success Metrics
| Metric | Target (Prototype) | Target (Production) |
|---|---|---|
| Lead time before predicted event | Demonstrable (simulated) | 6–24 hrs advance warning |
| Data sources integrated | ≥3 | 5+ (all listed in PS) |
| Alert delivery latency | <2 min (demo) | <5 min at scale |
| Dashboard load time | <3 sec | <3 sec under load |
| Offline field-report sync success | 100% (demo queue) | >95% in field conditions |
| False positive rate (risk alerts) | Documented baseline | <15% (post-tuning) |

---

## 4. Scope

### 4.1 In Scope (Prototype)
- Pilot area: 1–2 districts with a handful of known landslide-prone road stretches/villages (mock or public dataset-based).
- Rainfall data via public weather API (e.g., IMD/OpenWeather as proxy).
- Simulated soil moisture & slope/terrain data (synthetic or open DEM-derived slope data, e.g., SRTM/Bhuvan).
- Historical landslide records (public datasets, e.g., NRSC Bhuvan Landslide Atlas, GSI records) for model training/validation.
- Rule-based + lightweight ML risk scoring model.
- Web-based GIS dashboard (desktop + mobile-responsive).
- Citizen/field-reporting PWA with geo-tag, photo upload, offline queue + sync.
- Simulated SMS/push alert dispatch (actual SMS gateway optional/stretch).
- Multilingual UI for at least 2 languages (English + 1 regional, e.g., Assamese/Mizo/Nepali) as a proof of concept.

### 4.2 Out of Scope (Prototype)
- Real IoT sensor hardware deployment.
- Full satellite imagery processing pipeline (InSAR deformation analysis, etc.) — use derived/pre-processed data instead.
- Government system integration (Sachet, EOC systems) — mocked interfaces only.
- Full multi-state hilly-area coverage.
- Production-grade security/compliance certification.

---

## 5. User Personas

| Persona | Role | Key Needs |
|---|---|---|
| **District Officer (Anita)** | DDMA official | Quick view of highest-risk zones, road status, who to notify |
| **Field Inspector (Rahul)** | PWD/field staff | Fast way to report cracks/road damage from a remote site with poor signal |
| **Village Resident (Local user)** | Community member | Simple, local-language alert on phone: "avoid this road / evacuate" |
| **State Disaster Management Analyst (Nisha)** | Policy/planning | Aggregated trends, historical risk maps, infrastructure investment insights |

---

## 6. Functional Requirements

### FR1 — Data Ingestion Layer
- FR1.1: Pull rainfall data from weather API at regular intervals (e.g., hourly).
- FR1.2: Ingest terrain/slope data (static, pre-loaded DEM-derived slope angle per grid cell).
- FR1.3: Accept simulated/mock soil-moisture sensor feed (JSON payload, periodic).
- FR1.4: Load historical landslide incident records for model training and map overlay.
- FR1.5: Provide an API endpoint to accept citizen-submitted geo-tagged reports (photo + notes + location + timestamp).

### FR2 — AI/ML Risk Prediction Engine
- FR2.1: Compute a composite risk score (0–100 or Low/Medium/High/Critical) per grid cell sized to approximate a village/ward boundary, combining rainfall intensity, soil saturation proxy, slope angle, and historical incident density.
- FR2.2: Recompute scores on new data ingestion (near real-time).
- FR2.3: Flag zones crossing a configurable risk threshold for alert generation.
- FR2.4: Log prediction inputs/outputs for later model evaluation.
- FR2.5 (Stretch): Basic model explainability — show which factor(s) drove a high-risk score.

### FR3 — GIS Dashboard
- FR3.1: Interactive map with color-coded risk heatmap (Green/Yellow/Orange/Red).
- FR3.2: Layer toggles: rainfall, risk zones, road network, villages, active alerts, citizen reports.
- FR3.3: Click-to-inspect a zone: current risk score, contributing factors, recent reports, road status.
- FR3.4: Summary panel: total high-risk zones, affected roads, affected population estimate, active alerts.
- FR3.5: Weather-linked forecast view (next 24–48 hrs).
- FR3.6: Emergency response prioritization list (ranked by risk × population/infrastructure exposure).

### FR4 — Alerting System
- FR4.1: Auto-generate an alert when a zone crosses the risk threshold.
- FR4.2: Alert contains: location, risk level, recommended action, timestamp.
- FR4.3: Multi-channel dispatch (prototype: in-app notification + simulated SMS log; stretch: real SMS via gateway API).
- FR4.4: Multilingual alert templates (minimum English + 1 regional language).
- FR4.5: Authorities can acknowledge/escalate/close an alert.

### FR5 — Citizen & Field Reporting App (PWA)
- FR5.1: Capture geo-tagged photo/video + short description of hazard (crack, slope movement, blocked road).
- FR5.2: Works offline — queues reports locally and syncs when connectivity returns.
- FR5.3: Report status visible to submitter (Received / Under Review / Verified).
- FR5.4: Reports appear as pins on the GIS dashboard for authorities.

### FR6 — Admin / Configuration
- FR6.1: Admin can adjust risk thresholds per region.
- FR6.2: Admin can view/manage user roles (citizen, field officer, district officer, analyst).
- FR6.3: Admin can view system/data-source health status (last sync time, API status).

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Dashboard interactions respond in <3s; risk recompute cycle completes within data-refresh interval |
| **Availability** | Prototype target 95% uptime during demo; production target 99.5% |
| **Offline Support** | Field-reporting PWA must function fully offline and sync opportunistically |
| **Scalability** | Architecture should support scaling from 1–2 districts to multiple hilly states without redesign |
| **Localization** | UI and alerts support multiple languages; text externalized for easy translation |
| **Accessibility** | Low-bandwidth-optimized UI (compressed assets, minimal data payloads) for rural connectivity |
| **Security** | Role-based access control; encrypted data in transit (HTTPS); citizen data privacy safeguards |
| **Data Retention** | Historical risk/incident data retained for trend analysis and model retraining |
| **Interoperability** | Designed with open APIs to allow future integration with IMD, Bhuvan/NRSC, NDMA Sachet |

---

## 8. System Architecture (Prototype)

```
[Data Sources]
 ├─ Weather API (rainfall) ─────┐
 ├─ Simulated soil-moisture feed ┤
 ├─ DEM/slope static dataset ────┤──▶ [Ingestion Layer / API Gateway]
 ├─ Historical landslide dataset ┤          │
 └─ Citizen report uploads ──────┘          ▼
                                   [Data Processing & Storage]
                                   (Cloud DB + Object storage for media)
                                              │
                                              ▼
                                  [AI/ML Risk Scoring Engine]
                                   (rule-based + lightweight ML model)
                                              │
                              ┌───────────────┼────────────────┐
                              ▼               ▼                ▼
                     [GIS Dashboard]   [Alert Dispatch Svc]  [Reporting API]
                     (Web + mobile)    (SMS/App/Push, i18n)   (for field PWA)
                              │               │                │
                              ▼               ▼                ▼
                     District Officers   Communities      Field Officers
```

**Suggested prototype stack:**
- **Frontend:** React + Leaflet/Mapbox GL (GIS map), PWA with service workers for offline support
- **Backend:** Python (FastAPI) or Node.js (Express) — REST/GraphQL API
- **ML:** Python (scikit-learn / XGBoost for tabular risk scoring; simple weighted-rule fallback for demo reliability)
- **Database:** PostgreSQL + PostGIS (geospatial queries), Redis (caching), S3-compatible object storage (photos)
- **Data sources:** OpenWeatherMap/IMD API, SRTM/Bhuvan DEM data, GSI/NRSC landslide inventories, mocked sensor JSON feed
- **Alerts:** Twilio/mock SMS gateway, Firebase Cloud Messaging (push notifications)
- **Hosting:** Cloud (AWS/GCP/Azure) with CDN for low-bandwidth delivery

---

## 9. Data Sources & Integration (Prototype vs. Production)

| Data Type | Prototype Approach | Production Approach |
|---|---|---|
| Rainfall | Public weather API (current + forecast) | Direct IMD API/data feed |
| Soil Moisture | Simulated JSON feed with realistic ranges | Physical IoT soil sensors on-site |
| Satellite Imagery | Pre-downloaded/static sample imagery or open Sentinel-2 tiles | Live satellite feed + InSAR deformation analysis |
| Terrain/Slope | Open DEM data (SRTM 30m) processed offline | High-resolution LiDAR/DEM per state |
| Historical Landslides | Open datasets (GSI, Bhuvan Landslide Atlas, NRSC) | Continuously updated incident database with verified reports |

---

## 10. Risk Scoring Model (Prototype Approach)

A transparent, explainable **weighted composite score** is recommended for the prototype (before/alongside a trained ML model), since it's fast to demo and defensible:

```
RiskScore = w1*(RainfallIntensityNorm)
          + w2*(SoilSaturationProxyNorm)
          + w3*(SlopeAngleNorm)
          + w4*(HistoricalIncidentDensityNorm)
          + w5*(RecentCitizenReportSignal)
```
- Each factor normalized 0–1; weights (w1–w5) tunable via admin config.
- Stretch goal: train a classifier (e.g., Random Forest/XGBoost) on historical incident data labeled with these same features, and compare/blend with the rule-based score for validation.
- Output bucketed into **Low / Medium / High / Critical** for UI simplicity.

---

## 11. User Flows (Prototype)

1. **District Officer Flow:** Login → Dashboard loads pilot district map → Sees 2 zones flagged Orange/Red → Clicks zone → Views contributing factors + recent citizen reports → Acknowledges alert → Dispatches advisory.
2. **Field Officer Flow:** Opens PWA (possibly offline) → Takes photo of a slope crack → Adds note → Report queues → Connectivity returns → Report syncs → Appears on dashboard.
3. **Citizen Flow:** Receives SMS/app alert in local language: "High landslide risk near [village]. Avoid [road] until further notice." → Can tap for more info.
4. **System Flow:** Hourly data refresh → Risk engine recomputes scores → Threshold breach detected → Alert generated → Multi-channel dispatch triggered → Logged for audit.

---

## 12. Prototype Build Plan (Suggested Hackathon Timeline)

| Phase | Duration | Deliverable |
|---|---|---|
| 1. Setup & Data | Day 1 | Data sources identified, pilot area chosen, static datasets loaded |
| 2. Risk Engine | Day 1–2 | Weighted risk scoring function working on sample data |
| 3. GIS Dashboard | Day 2–3 | Map with heatmap, zone click-through, summary panel |
| 4. Alerts | Day 3 | Threshold-triggered alert generation + simulated dispatch, i18n templates |
| 5. Field Reporting PWA | Day 3–4 | Offline-capable geo-tagged report form + sync + dashboard pin display |
| 6. Integration & Polish | Day 4 | End-to-end demo flow, seed demo scenario (simulate a rainfall spike → risk rises → alert fires) |
| 7. Demo Prep | Day 5 | Pitch deck, live/recorded demo, PRD finalization |

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| No access to real sensor/satellite data in prototype timeframe | Medium | Use open datasets + realistic simulated feeds; clearly label as simulated in demo |
| GIS map performance with large datasets | Medium | Limit prototype to pilot district; use vector tiles/clustering |
| Alert fatigue / false positives | High (production) | Threshold tuning, explainability panel, human-in-the-loop acknowledgment |
| Low connectivity undermining real-time promise | High | Offline-first PWA design, SMS as fallback channel, edge caching |
| Multilingual content accuracy | Medium | Start with pre-translated static templates; expand via professional translation later |
| Data privacy of citizen-submitted photos/location | Medium | Role-based access, anonymization options, clear consent messaging |

---

## 14. Open Questions

- Which specific district(s)/road corridors should the pilot target (need known high-risk hotspot for realistic demo)?
- Will a real SMS gateway (e.g., Twilio trial) be used, or is a simulated log sufficient for judging?
- Which regional language(s) should be prioritized for the multilingual proof of concept?
- Is there access to any GSI/NRSC historical landslide dataset for the specific pilot area, or should synthetic historical data be generated?
- What level of ML sophistication is expected by judges — rule-based transparency vs. a trained model with reported accuracy metrics?

---

## 15. Appendix — Alignment to Problem Statement Requirements (PSID 26192)

| PS Requirement | Addressed By |
|---|---|
| Rainfall data integration | FR1.1, Section 9 |
| Soil moisture sensors | FR1.3, Section 9 |
| Slope stability models | FR1.2, Section 10 |
| Historical landslide/flood inventories | FR1.4, Section 9 |
| Real-time IoT inputs | FR1.3, FR5.1 (citizen/field reports as supplementary real-time signal) |
| Hyper-local forecasts at village/ward level | FR2.1–FR2.3, Section 10 (grid-cell scoring sized to village/ward) |
| Actionable lead time for evacuation & preparedness | FR4, Section 11 (System Flow), Success Metrics (Section 3.3) |
| AI/ML risk identification & prediction | FR2, Section 10 |
| Real-time alerts to authorities/communities | FR4 |
| GIS mapping visualization | FR3 |
| Citizen/field geo-tagged photo/video uploads | FR5 |
| Dashboards: risk severity, road status, weather forecast, response prioritization | FR3.4–FR3.6 |
| Multilingual notifications | FR4.4, NFR Localization |
| Low-network/offline functionality | FR5.2, NFR Offline Support |
