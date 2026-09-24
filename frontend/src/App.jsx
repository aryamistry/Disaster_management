import './index.css';
import { AppProvider } from './context/AppContext.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import RiskMap from './components/RiskMap.jsx';
import BottomBar from './components/BottomBar.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from './context/AppContext.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import { getPrioritization } from './api.js';

function Toolbar() {
  const { riskScores, districts, geoFeatures, focusGrid, navigate, addToast, error } = useApp();
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const values = [
      ...riskScores.map(s => ({ label: `${s.grid_id} · ${s.district}`, detail: s.risk_level, gridId: s.grid_id })),
      ...districts.flatMap(d => [d.name, ...(d.villages || []), ...(d.roads || [])].map(label => ({ label, detail: d.name }))),
      ...(geoFeatures.road_corridors || []).map(r => ({ label: r.name, detail: r.district })),
    ];
    return values.filter(item => item.label.toLowerCase().includes(needle)).slice(0, 6);
  }, [query, riskScores, districts, geoFeatures]);

  return (
    <>
      <div className="toolbar">
        <div className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search districts, villages, roads or grid cells" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search districts, villages, roads or grid cells" />
          {matches.length > 0 && <div className="search-results">{matches.map((item, index) => <button className="search-result" key={`${item.label}-${index}`} onClick={() => item.gridId ? focusGrid(item.gridId) : navigate('Live Map')}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div>}
        </div>
        <button className="button button-primary" onClick={() => window.open('/pwa/index.html', '_blank')}><span aria-hidden="true">＋</span> Report a hazard</button>
        <button className="button button-safe" onClick={() => addToast({ level: 'info', title: 'Check-in noted', msg: 'This is a local confirmation only. SMS and push delivery are not wired yet.' })}><span aria-hidden="true">✓</span> I’m safe</button>
      </div>
      <div className="notice-bar"><strong>Data status:</strong> Risk scores, alerts, field reports and sensor readings are live from the local service. Weather outlook is simulated; roads, villages, historical incidents and model inputs are static source data.</div>
      {error && <div className="app-error" role="alert">{error}</div>}
    </>
  );
}

function RightRail() {
  const { alerts, loading, focusGrid, addToast } = useApp();
  const [locationState, setLocationState] = useState('idle');
  const activeAlerts = alerts.filter(alert => alert.status === 'Active');
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('unsupported');
      return;
    }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      position => { setLocationState('granted'); window.dispatchEvent(new CustomEvent('center-map', { detail: position.coords })); },
      () => { setLocationState('denied'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  return <aside className="right-rail">
    <section className="panel location-card"><div className="panel-heading"><div><span className="eyebrow">Location access</span><h2>Use current location</h2></div><span aria-hidden="true" className="panel-icon">⌖</span></div><p>Use your device location to center the map. This dashboard does not store the location.</p><button className="button button-outline" onClick={requestLocation} disabled={locationState === 'requesting'}><span aria-hidden="true">⌖</span> {locationState === 'requesting' ? 'Requesting…' : 'Allow location access'}</button>{locationState === 'denied' && <div className="inline-error">Location permission was denied. Enable it in the browser to center the map.</div>}{locationState === 'unsupported' && <div className="inline-error">This browser does not provide location access.</div>}{locationState === 'granted' && <div className="inline-success">Location received; map centered.</div>}</section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Operations</span><h2>Live alerts <span className="count-badge">{activeAlerts.length}</span></h2></div><span className="live-indicator">LIVE</span></div>{loading ? <div className="panel-state"><span className="spinner" /> Loading alerts</div> : activeAlerts.length === 0 ? <div className="panel-state">No active alerts</div> : <div className="alert-list">{activeAlerts.map(alert => <button className={`alert-row alert-severity-${alert.risk_level?.toLowerCase()}`} key={alert.id} onClick={() => focusGrid(alert.grid_id)}><span className="risk-dot" /><div><strong>{alert.risk_level} · {alert.grid_id}</strong><p>{alert.message_en}</p><small>{alert.district}</small></div></button>)}</div>}</section>
    <section className="panel safety-card"><div className="panel-heading"><div><span className="eyebrow">Community</span><h2>Safety check-ins</h2></div><label className="switch"><input type="checkbox" onChange={e => addToast({ level: 'info', title: e.target.checked ? 'Check-ins enabled' : 'Check-ins paused', msg: 'No SMS or push gateway is wired yet.' })} /><span /></label></div><p>Check-in coordination is a UI stub. No SMS or push gateway is wired yet.</p><button className="button button-outline" onClick={() => addToast({ level: 'info', title: 'Contact management unavailable', msg: 'Adding contacts requires a notification gateway.' })}><span aria-hidden="true">＋</span> Add contact</button></section>
  </aside>;
}

function ListView({ title, eyebrow, items, empty = 'No records available.' }) {
  return <section className="content-view panel"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{items.length === 0 ? <div className="panel-state">{empty}</div> : <div className="view-list">{items.map(item => <button className={`view-list-row ${item.className || ''}`} key={item.key} onClick={item.onClick}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>}</section>;
}

function ResponseView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPrioritization().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  return <section className="content-view panel"><span className="eyebrow">Emergency response</span><h1>Response priorities</h1>{loading ? <div className="panel-state"><span className="spinner" /> Loading priorities</div> : items.length === 0 ? <div className="panel-state">No high-risk response priorities.</div> : <div className="view-list">{items.map(item => <div className={`view-list-row alert-severity-${item.risk_level?.toLowerCase()}`} key={item.grid_id}><strong>{item.priority_tier} · {item.grid_id} · {item.risk_level}<small>{item.recommended_action}</small></strong><span>Priority {item.priority_score} · {item.district_name}<br />Roads: {item.nearby_roads}<br />Villages: {item.nearby_villages}</span></div>)}</div>}</section>;
}

function MainView() {
  const { activeView, alerts, reports, riskScores, districts, focusGrid, navigate } = useApp();
  if (activeView === 'Admin') return <AdminPanel onClose={() => navigate('Overview')} />;
  if (activeView === 'Risk Zones') return <ListView eyebrow="Model output" title="Grid cells / risk zones" items={riskScores.map(s => ({ key: s.grid_id, title: `${s.grid_id} · ${s.risk_level}`, detail: `${s.district} · score ${s.composite_score?.toFixed(1)}/100`, onClick: () => focusGrid(s.grid_id) }))} />;
  if (activeView === 'Field Reports') return <ListView eyebrow="Live reports" title="Field reports" items={reports.map(r => ({ key: r.id, title: r.report_type?.replaceAll('_', ' ') || 'Report', detail: `${r.grid_id || 'Unassigned'} · ${r.status}` }))} empty="No citizen reports received." />;
  if (activeView === 'Shelters & Roads') return <ListView eyebrow="Static source data" title="Shelters & roads" items={districts.flatMap(d => (d.roads || []).map(road => ({ key: `${d.id}-${road}`, title: road, detail: d.name })))} empty="No road corridors returned." />;
  if (activeView === 'Alerts') return <ListView eyebrow="Live alerts" title="Alerts" items={alerts.map(a => ({ key: a.id, title: `${a.risk_level} · ${a.grid_id}`, detail: a.message_en, className: `alert-severity-${a.risk_level?.toLowerCase()}`, onClick: () => focusGrid(a.grid_id) }))} empty="No active alerts." />;
  if (activeView === 'Weather') return <ListView eyebrow="Simulated source" title="Weather outlook" items={[{ key: 'source', title: 'Simulated rainfall projection', detail: 'Open the overview to view the current 12-hour outlook.' }]} />;
  if (activeView === 'Response') return <ResponseView />;
  return <><div className="dashboard-grid"><section className="map-column"><RiskMap /></section><RightRail /></div><BottomBar /></>;
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Header />
        <Sidebar />
        <div className="main-content">
          <Toolbar />
          <div className="notice-spacer" />
          <MainView />
        </div>
      </div>
      <ToastContainer />
    </AppProvider>
  );
}
