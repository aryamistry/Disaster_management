import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../context/AppContext.jsx';
import { getHistoricalLandslides, getRiskHistory, getSensorReadings, getGeoFeatures } from '../api.js';
import ZonePanel from './ZonePanel.jsx';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const RISK_COLORS = {
  Critical: { fill: '#ef4444', border: '#dc2626', opacity: 0.75 },
  High: { fill: '#f97316', border: '#ea580c', opacity: 0.65 },
  Medium: { fill: '#eab308', border: '#ca8a04', opacity: 0.55 },
  Low: { fill: '#22c55e', border: '#16a34a', opacity: 0.35 },
};

export default function RiskMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const { riskScores, reports, alerts, layers, setSelectedZone, selectedZone } = useApp();
  const [panelData, setPanelData] = useState(null);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [27.3, 88.35],
      zoom: 10,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '©OpenStreetMap ©CartoDB',
      maxZoom: 18,
    }).addTo(map);

    // Attribution small
    L.control.attribution({ position: 'bottomleft' }).addTo(map);

    mapInstanceRef.current = map;
  }, []);

  // Update risk zone circles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || riskScores.length === 0) return;

    // Clear existing zone circles
    if (layersRef.current.zones) {
      layersRef.current.zones.forEach(c => c.remove());
    }
    if (layersRef.current.heatPoints) {
      layersRef.current.heatPoints.forEach(c => c.remove());
    }

    const circles = [];
    const heatCircles = [];

    riskScores.forEach(score => {
      if (!score.lat || !score.lng) return;
      const color = RISK_COLORS[score.risk_level] || RISK_COLORS.Low;
      const radius = 2500 + (score.composite_score / 100) * 2000;

      // Heatmap-style filled circle (shown when heatmap layer on)
      if (layers.heatmap) {
        const heat = L.circle([score.lat, score.lng], {
          radius: radius * 1.3,
          color: 'transparent',
          fillColor: color.fill,
          fillOpacity: color.opacity * 0.45,
          weight: 0,
        }).addTo(map);
        heatCircles.push(heat);
      }

      // Zone circle (shown when zones layer on)
      if (layers.zones) {
        const circle = L.circle([score.lat, score.lng], {
          radius,
          color: color.border,
          fillColor: color.fill,
          fillOpacity: color.opacity,
          weight: 2,
        });

        circle.on('click', async () => {
          setSelectedZone(score);
          const [history, sensor] = await Promise.all([
            getRiskHistory(score.grid_id),
            getSensorReadings(score.grid_id),
          ]);
          setPanelData({ score, history, sensor });
        });

        circle.bindTooltip(`
          <div style="font-family:Inter,sans-serif;font-size:12px;">
            <strong>${score.grid_id}</strong> · ${score.district}<br/>
            <span style="color:${color.fill};font-weight:700">${score.risk_level}</span> — Score: ${score.composite_score?.toFixed(1)}/100<br/>
            📍 Primary factor: ${score.primary_factor}<br/>
            🏔 ${score.elevation}m · Slope ${score.slope_angle}°
          </div>
        `, { className: 'leaflet-tooltip-dark', sticky: true });

        circle.addTo(map);
        circles.push(circle);
      }
    });

    layersRef.current.zones = circles;
    layersRef.current.heatPoints = heatCircles;
  }, [riskScores, layers.zones, layers.heatmap]);

  // Citizen report markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (layersRef.current.reports) layersRef.current.reports.forEach(m => m.remove());
    if (!layers.reports || reports.length === 0) return;

    const markers = reports.map(r => {
      if (!r.lat || !r.lng) return null;
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#a855f7;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(168,85,247,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      });
      const m = L.marker([r.lat, r.lng], { icon });
      m.bindTooltip(`<b>📷 ${r.report_type?.replace('_',' ')}</b><br/>${r.description || ''}<br/><small>${r.reporter_name}</small>`);
      m.addTo(map);
      return m;
    }).filter(Boolean);

    layersRef.current.reports = markers;
  }, [reports, layers.reports]);

  // Alert markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (layersRef.current.alertMarkers) layersRef.current.alertMarkers.forEach(m => m.remove());
    if (!layers.alerts || alerts.length === 0) return;

    const active = alerts.filter(a => a.status === 'Active');
    const markers = [];
    active.forEach(a => {
      const score = riskScores.find(s => s.grid_id === a.grid_id);
      if (!score?.lat) return;
      const color = RISK_COLORS[a.risk_level]?.fill || '#ef4444';
      const icon = L.divIcon({
        html: `<div style="
          width:24px;height:24px;
          background:${color};
          border:3px solid #fff;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          box-shadow:0 0 12px ${color}88;
          animation:pulse 1.5s infinite;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        className: '',
      });
      const m = L.marker([score.lat, score.lng], { icon, zIndexOffset: 1000 });
      m.bindTooltip(`<b>⚠️ ${a.risk_level} Alert</b><br/>${a.grid_id}<br/>${a.affected_roads || ''}`);
      m.addTo(map);
      markers.push(m);
    });
    layersRef.current.alertMarkers = markers;
  }, [alerts, layers.alerts, riskScores]);

  // Road network layer — coordinates fetched from backend (FIX-5.2)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (layersRef.current.roadLines) layersRef.current.roadLines.forEach(l => l.remove());
    if (!layers.roads) return;

    getGeoFeatures().then(geoData => {
      if (!geoData?.road_corridors) return;
      const lines = geoData.road_corridors.map(road => {
        const line = L.polyline(road.points, {
          color: road.color,
          weight: 3,
          opacity: 0.85,
          dashArray: '8, 5',
        });
        line.bindTooltip(`<b>🛣 ${road.name}</b><br/><small>${road.district}</small>`, { sticky: true });
        line.addTo(map);
        return line;
      });
      layersRef.current.roadLines = lines;
    }).catch(() => {});
  }, [layers.roads]);

  // Village markers layer — positions fetched from backend (FIX-5.2)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (layersRef.current.villageMarkers) layersRef.current.villageMarkers.forEach(m => m.remove());
    if (!layers.villages) return;

    getGeoFeatures().then(geoData => {
      if (!geoData?.village_positions) return;
      const markers = [];

      for (const [distId, villages] of Object.entries(geoData.village_positions)) {
        for (const v of villages) {
          const icon = L.divIcon({
            html: `<div style="
              display:flex;flex-direction:column;align-items:center;
            "><div style="
              width:10px;height:10px;background:#60a5fa;border:2px solid #fff;
              border-radius:50%;box-shadow:0 0 8px rgba(96,165,250,0.7);
            "></div><div style="
              width:2px;height:6px;background:#60a5fa;margin-top:0;
            "></div></div>`,
            iconSize: [10, 18], iconAnchor: [5, 18], className: '',
          });
          const m = L.marker([v.lat, v.lng], { icon });
          m.bindTooltip(`<b>🏘 ${v.name}</b><br/><small>District ${distId}</small>`, { sticky: true });
          m.addTo(map);
          markers.push(m);
        }
      }
      layersRef.current.villageMarkers = markers;
    }).catch(() => {});
  }, [layers.villages]);

  // Historical landslide markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    getHistoricalLandslides().then(data => {
      if (!data || !Array.isArray(data)) return;
      data.forEach(ls => {
        const icon = L.divIcon({
          html: `<div style="font-size:14px;line-height:1;" title="${ls.description}">⚠️</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          className: '',
        });
        L.marker([ls.lat, ls.lng], { icon, opacity: 0.6 })
          .bindTooltip(`<b>Historical: ${ls.date}</b><br/>${ls.description}<br/>Severity: ${ls.severity}`)
          .addTo(map);
      });
    });
  }, []);

  return (
    <div className="map-wrapper">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {panelData && (
        <ZonePanel data={panelData} onClose={() => { setPanelData(null); setSelectedZone(null); }} />
      )}
    </div>
  );
}
