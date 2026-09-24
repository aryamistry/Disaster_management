import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getForecast, getRiskHistory, getSensorReadings } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

function ago(ts) {
  if (!ts) return 'time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}

export default function BottomBar() {
  const { reports, alerts, selectedZone } = useApp();
  const [readings, setReadings] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [forecastLoading, setForecastLoading] = useState(true);
  const [sensorLoading, setSensorLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      setSensorLoading(true);
      getSensorReadings().then(setReadings).catch(() => setError('Sensor log unavailable')).finally(() => setSensorLoading(false));
      setForecastLoading(true);
      getForecast().then(setForecast).catch(() => setError('Forecast unavailable')).finally(() => setForecastLoading(false));
    };
    load();
    const poll = setInterval(load, 120000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!selectedZone?.grid_id) { setHistory([]); return undefined; }
    getRiskHistory(selectedZone.grid_id).then(setHistory).catch(() => setHistory([]));
    return undefined;
  }, [selectedZone]);

  const events = useMemo(() => [
    ...alerts.filter(a => a.status === 'Active').map(a => ({ type: 'alert', icon: '!', title: `${a.risk_level} alert`, detail: a.grid_id, time: a.created_at })),
    ...reports.slice(0, 8).map(r => ({ type: 'report', icon: 'R', title: r.report_type?.replaceAll('_', ' ') || 'field report', detail: r.grid_id || 'location report', time: r.submitted_at })),
    ...readings.slice(0, 8).map(r => ({ type: 'sensor', icon: 'S', title: `${r.rainfall_1h_mm} mm/hr rainfall`, detail: r.grid_id, time: r.timestamp })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 12), [alerts, reports, readings]);

  const chart = history.slice(0, 7).reverse().map((item, index) => ({ day: `-${6 - index}d`, risk: Number(item.composite_score || 0), rain: Number(item.rainfall_24h_mm || 0) }));
  const selectedDistrict = selectedZone?.district || 'D001';
  const outlookDistrict = forecast?.districts?.find(item => item.id === selectedDistrict) || forecast?.districts?.[0];
  const outlook = outlookDistrict?.hourly?.slice(0, 12) || [];
  const trendContent = !selectedZone ? <div className="panel-state">Select a grid cell on the map to view history</div> : chart.length < 2 ? <div className="panel-state">History unavailable for {selectedZone.grid_id}</div> : <><ResponsiveContainer width="100%" height={120}><LineChart data={chart}><CartesianGrid stroke="#ECEFF2" /><XAxis dataKey="day" tick={{ fontSize: 9 }} /><YAxis yAxisId="risk" tick={{ fontSize: 9 }} /><YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 9 }} /><Tooltip /><Line yAxisId="risk" type="monotone" dataKey="risk" stroke="#C33A3A" strokeWidth={2} dot={false} /><Line yAxisId="rain" type="monotone" dataKey="rain" stroke="#1D4E7A" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer><div className="chart-legend"><span><i className="legend-risk" /> Risk score</span><span><i className="legend-rain" /> Rainfall mm</span></div></>;

  return <div className="bottom-grid">
    <section className="bottom-panel"><div className="bottom-title"><div><span className="eyebrow">Live feed</span><h2>Field &amp; sensor log</h2></div><span className="source-tag live-tag">LIVE</span></div>{error && <div className="inline-error">{error}</div>}{sensorLoading ? <div className="panel-state"><span className="spinner" /> Loading sensor events</div> : events.length === 0 ? <div className="panel-state">No recent events</div> : <div className="event-list">{events.map((event, index) => <div className="event-row" key={`${event.type}-${event.time}-${index}`}><span className={`event-icon ${event.type}`}>{event.icon}</span><div><strong>{event.title}</strong><span>{event.detail}</span></div><time>{ago(event.time)}</time></div>)}</div>}</section>
    <section className="bottom-panel"><div className="bottom-title"><div><span className="eyebrow">Outlook</span><h2>Rainfall &amp; slope outlook</h2></div><span className="source-tag simulated-tag">SIMULATED</span></div>{forecastLoading ? <div className="panel-state"><span className="spinner" /> Loading outlook</div> : outlook.length === 0 ? <div className="panel-state">Forecast unavailable</div> : <><div className="radar-bars">{outlook.map((point, index) => <div key={point.time || index} className="radar-bar" style={{ height: `${Math.max(12, Math.min(100, point.rainfall_mm * 3))}%` }} title={`${point.rainfall_mm} mm`}><span /></div>)}</div><div className="outlook-caption">12-hour rainfall projection · {outlookDistrict.name}<br /><small>Illustrative projection from the simulated forecast service.</small></div></>}</section>
    <section className="bottom-panel"><div className="bottom-title"><div><span className="eyebrow">Trend</span><h2>Risk &amp; rainfall</h2></div><span className="source-tag live-tag">{selectedZone ? selectedZone.grid_id : 'SELECT A ZONE'}</span></div>{trendContent}</section>
  </div>;
}
