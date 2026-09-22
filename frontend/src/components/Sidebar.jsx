import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { updateAlertStatus, triggerRiskCompute, getForecast, getPrioritization } from '../api.js';

const MSG_KEY = { en: 'message_en', hi: 'message_hi', mz: 'message_mz' };
const RISK_COLORS = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function RainBar({ mm, max = 60 }) {
  const pct = Math.min(100, (mm / max) * 100);
  const color = mm > 35 ? '#ef4444' : mm > 20 ? '#f97316' : mm > 10 ? '#eab308' : '#22c55e';
  return (
    <div style={{ height: 28, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
      <div style={{ width: '100%', height: `${pct}%`, minHeight: 2, background: color, borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease' }} />
    </div>
  );
}

export default function Sidebar() {
  const { summary, alerts, reports, layers, toggleLayer, fetchAll, language, riskScores, loading } = useApp();
  const [tab, setTab] = useState('alerts');
  const [demoBusy, setDemoBusy] = useState(false);
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [prioritization, setPrioritization] = useState(null);
  const [prioLoading, setPrioLoading] = useState(false);
  const [alertAction, setAlertAction] = useState({}); // { [id]: 'loading' }

  const activeAlerts = alerts.filter(a => a.status === 'Active');

  // Load forecast when tab selected
  useEffect(() => {
    if (tab === 'forecast' && !forecast) {
      setForecastLoading(true);
      getForecast().then(d => setForecast(d)).catch(() => {}).finally(() => setForecastLoading(false));
    }
  }, [tab, forecast]);

  // Load prioritization when tab selected
  useEffect(() => {
    if (tab === 'response') {
      setPrioLoading(true);
      getPrioritization().then(d => setPrioritization(d)).catch(() => {}).finally(() => setPrioLoading(false));
    }
  }, [tab]);

  const handleAlertAction = async (alertId, status, e) => {
    e.stopPropagation();
    setAlertAction(a => ({ ...a, [alertId]: 'loading' }));
    const actor = status === 'Escalated' ? 'District Officer → State EOC' : status === 'Closed' ? 'District Officer Anita' : 'District Officer Anita';
    await updateAlertStatus(alertId, status, actor);
    fetchAll();
    setAlertAction(a => ({ ...a, [alertId]: null }));
  };

  const handleSpike = async () => {
    setDemoBusy(true);
    await triggerRiskCompute(true);
    await fetchAll();
    setForecast(null); // refresh forecast on next view
    setPrioritization(null);
    setDemoBusy(false);
  };

  const handleNormal = async () => {
    setDemoBusy(true);
    await triggerRiskCompute(false);
    await fetchAll();
    setForecast(null);
    setPrioritization(null);
    setDemoBusy(false);
  };

  const TABS = [
    { id: 'alerts', label: `Alerts${activeAlerts.length > 0 ? ` (${activeAlerts.length})` : ''}` },
    { id: 'reports', label: `Reports${reports.length > 0 ? ` (${reports.length})` : ''}` },
    { id: 'zones', label: 'Zones' },
    { id: 'forecast', label: '🌧 Forecast' },
    { id: 'response', label: '🚨 Response' },
  ];

  return (
    <aside className="sidebar">
      {/* Summary Cards */}
      <div className="sidebar-section">
        <div className="sidebar-label">Risk Overview</div>
        {summary ? (
          <div className="summary-grid">
            <div className="stat-card">
              <div className="val risk-critical">{summary.risk_distribution?.critical || 0}</div>
              <div className="lbl">Critical Zones</div>
            </div>
            <div className="stat-card">
              <div className="val risk-high">{summary.risk_distribution?.high || 0}</div>
              <div className="lbl">High Risk</div>
            </div>
            <div className="stat-card">
              <div className="val" style={{color:'var(--accent-blue)'}}>{summary.active_alerts || 0}</div>
              <div className="lbl">Active Alerts</div>
            </div>
            <div className="stat-card">
              <div className="val" style={{color:'#a855f7'}}>{summary.recent_citizen_reports || 0}</div>
              <div className="lbl">Field Reports (24h)</div>
            </div>
          </div>
        ) : loading ? (
          <div style={{display:'flex', alignItems:'center', gap:8, color:'var(--text-muted)', fontSize:'0.8rem'}}>
            <div className="spinner" style={{width:16,height:16,borderWidth:2}} /> Loading...
          </div>
        ) : null}
      </div>

      {/* Demo Controls */}
      <div className="sidebar-section">
        <div className="sidebar-label">🎮 Demo Controls</div>
        <button className="demo-btn demo-btn-spike" disabled={demoBusy} onClick={handleSpike}>
          {demoBusy ? '⏳ Computing...' : '⚡ Simulate Rainfall Spike'}
        </button>
        <button className="demo-btn demo-btn-normal" disabled={demoBusy} onClick={handleNormal} style={{marginTop:6}}>
          🔄 Normal Cycle Refresh
        </button>
        <p style={{fontSize:'0.65rem', color:'var(--text-muted)', marginTop:6}}>Spike injects 55–85mm/hr rainfall on high-slope zones to trigger Critical alerts</p>
      </div>

      {/* Layer Toggles */}
      <div className="sidebar-section">
        <div className="sidebar-label">Map Layers</div>
        <div className="layer-toggles">
          {Object.entries(layers).map(([key, val]) => (
            <button key={key} className={`layer-btn ${val ? 'active' : ''}`} onClick={() => toggleLayer(key)}>
              {key === 'heatmap' ? '🌡 Heatmap' : key === 'zones' ? '📍 Zones' : key === 'roads' ? '🛣 Roads' : key === 'villages' ? '🏘 Villages' : key === 'alerts' ? '🔔 Alerts' : '📷 Reports'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="sidebar-section" style={{paddingBottom:0}}>
        <div className="tabs" style={{overflowX:'auto', flexWrap:'nowrap'}}>
          {TABS.map(t => (
            <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)} style={{whiteSpace:'nowrap'}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="sidebar-section" style={{flex:1, overflow:'auto'}}>
        {/* ── ALERTS TAB ── */}
        {tab === 'alerts' && (
          <div className="fade-in">
            {activeAlerts.length === 0 ? (
              <div style={{color:'var(--text-muted)', fontSize:'0.8rem', textAlign:'center', padding:'20px 0'}}>
                ✅ No active alerts
              </div>
            ) : activeAlerts.map((a, idx) => (
              <div key={`${a.id || 'alert'}-${a.grid_id || ''}-${idx}`} className={`alert-item ${a.risk_level?.toLowerCase()}`}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span className={`alert-badge badge-${a.risk_level?.toLowerCase()}`}>
                    {a.risk_level === 'Critical' ? '🔴' : a.risk_level === 'High' ? '🟠' : '🟡'} {a.risk_level}
                  </span>
                  <span style={{fontSize:'0.65rem', color:'var(--text-muted)'}}>{a.composite_score?.toFixed(0)}/100</span>
                </div>
                <div className="alert-text">{a[MSG_KEY[language]] || a.message_en}</div>
                <div className="alert-time">📍 {a.grid_id} · {a.district} · {timeAgo(a.created_at)}</div>
                {a.affected_roads && <div className="alert-time">🛣 {a.affected_roads}</div>}
                {/* Action buttons */}
                <div style={{display:'flex', gap:4, marginTop:8, flexWrap:'wrap'}}>
                  <button className="alert-action-btn ack" onClick={(e) => handleAlertAction(a.id, 'Acknowledged', e)}
                    disabled={alertAction[a.id] === 'loading'}>
                    ✓ Ack
                  </button>
                  <button className="alert-action-btn escalate" onClick={(e) => handleAlertAction(a.id, 'Escalated', e)}
                    disabled={alertAction[a.id] === 'loading'}>
                    🚨 Escalate
                  </button>
                  <button className="alert-action-btn close-alert" onClick={(e) => handleAlertAction(a.id, 'Closed', e)}
                    disabled={alertAction[a.id] === 'loading'}>
                    ✕ Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === 'reports' && (
          <div className="fade-in">
            {reports.length === 0 ? (
              <div style={{color:'var(--text-muted)', fontSize:'0.8rem', textAlign:'center', padding:'20px 0'}}>
                No citizen reports yet
              </div>
            ) : reports.slice(0,20).map(r => (
              <div key={r.id} className="alert-item" style={{borderLeftColor:'#a855f7'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span className="alert-badge" style={{background:'rgba(168,85,247,0.1)', color:'#a855f7'}}>
                    📷 {r.report_type?.replace('_',' ')}
                  </span>
                  <span className={`alert-badge report-status-badge status-${r.status?.toLowerCase().replace(' ','-')}`}>
                    {r.status}
                  </span>
                </div>
                <div className="alert-text">{r.description || 'No description'}</div>
                <div className="alert-time">📍 ({r.lat?.toFixed(3)}, {r.lng?.toFixed(3)}) · {timeAgo(r.submitted_at)}</div>
                <div className="alert-time">👤 {r.reporter_name}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── ZONES TAB ── */}
        {tab === 'zones' && (
          <div className="fade-in">
            {riskScores.slice(0,10).map(s => (
              <div key={s.grid_id} className="alert-item" style={{borderLeftColor: RISK_COLORS[s.risk_level]}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span style={{fontWeight:700, fontSize:'0.8rem', fontFamily:"'Space Grotesk'"}}>{s.grid_id}</span>
                  <span className={`alert-badge badge-${s.risk_level?.toLowerCase()}`}>{s.risk_level}</span>
                </div>
                <div style={{marginTop:6}}>
                  {[['Rainfall', s.rainfall_score], ['Soil', s.soil_score], ['Slope', s.slope_score]].map(([f, v]) => (
                    <div key={f} className="factor-bar">
                      <div className="factor-label"><span>{f}</span><span>{v?.toFixed(0)}</span></div>
                      <div className="factor-track">
                        <div className="factor-fill" style={{width:`${v}%`, background: v > 70 ? 'var(--risk-critical)' : v > 50 ? 'var(--risk-high)' : v > 30 ? 'var(--risk-medium)' : 'var(--risk-low)'}} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="alert-time" style={{marginTop:4}}>🏔 {s.elevation}m · Slope {s.slope_angle}° · Score {s.composite_score?.toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── FORECAST TAB ── */}
        {tab === 'forecast' && (
          <div className="fade-in">
            {forecastLoading ? (
              <div style={{display:'flex',justifyContent:'center',padding:'24px 0'}}><div className="spinner" /></div>
            ) : !forecast ? (
              <div style={{color:'var(--text-muted)',fontSize:'0.8rem',textAlign:'center',padding:'20px 0'}}>Could not load forecast</div>
            ) : (
              <>
                <div style={{fontSize:'0.65rem',color:'var(--text-muted)',marginBottom:10}}>
                  📡 Simulated 48h rainfall projection based on current sensor data · Generated {new Date(forecast.generated_at).toLocaleTimeString()}
                </div>
                {forecast.districts.map(d => (
                  <div key={d.id} style={{marginBottom:18}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <span style={{fontWeight:700,fontSize:'0.82rem',fontFamily:"'Space Grotesk'"}}>{d.name}</span>
                      <span style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Peak: {d.summary.max_24h?.toFixed(1)}mm/h in 24h</span>
                    </div>
                    {/* Forecast summary cards */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
                      <div className="forecast-card">
                        <div className="forecast-val">{d.summary.avg_24h?.toFixed(1)}</div>
                        <div className="forecast-lbl">Avg mm/h (24h)</div>
                      </div>
                      <div className="forecast-card">
                        <div className="forecast-val" style={{color: d.summary.critical_hours_24h > 0 ? 'var(--risk-critical)' : 'var(--risk-medium)'}}>
                          {d.summary.high_risk_hours_24h}h
                        </div>
                        <div className="forecast-lbl">High-risk hours</div>
                      </div>
                      <div className="forecast-card">
                        <div className="forecast-val">{d.summary.max_48h?.toFixed(1)}</div>
                        <div className="forecast-lbl">Peak mm/h (48h)</div>
                      </div>
                    </div>
                    {/* Hourly bar chart — first 24h */}
                    <div style={{fontSize:'0.65rem',color:'var(--text-muted)',marginBottom:4}}>Next 24 hours (hourly rainfall mm/h)</div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:2,height:48,background:'var(--bg-primary)',borderRadius:8,padding:'4px 6px'}}>
                      {d.hourly.slice(0,24).map((pt, i) => {
                        const h = new Date(pt.time).getHours();
                        const color = pt.risk_level === 'Critical' ? '#ef4444' : pt.risk_level === 'High' ? '#f97316' : pt.risk_level === 'Medium' ? '#eab308' : '#22c55e';
                        return (
                          <div key={i} title={`${h}:00 — ${pt.rainfall_mm}mm/h (${pt.risk_level})`}
                            style={{flex:1,background:color,borderRadius:'2px 2px 0 0',
                              height:`${Math.max(4, (pt.rainfall_mm/60)*100)}%`,opacity:0.85,transition:'height 0.3s'}} />
                        );
                      })}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.58rem',color:'var(--text-muted)',marginTop:2,padding:'0 2px'}}>
                      <span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span>
                    </div>
                    {/* Next 24-48h */}
                    <div style={{fontSize:'0.65rem',color:'var(--text-muted)',margin:'8px 0 4px'}}>Next 24–48 hours</div>
                    <div style={{display:'flex',alignItems:'flex-end',gap:2,height:32,background:'var(--bg-primary)',borderRadius:8,padding:'4px 6px'}}>
                      {d.hourly.slice(24,48).map((pt, i) => {
                        const color = pt.risk_level === 'Critical' ? '#ef4444' : pt.risk_level === 'High' ? '#f97316' : pt.risk_level === 'Medium' ? '#eab308' : '#22c55e';
                        return (
                          <div key={i} title={`h+${24+i} — ${pt.rainfall_mm}mm/h`}
                            style={{flex:1,background:color,borderRadius:'2px 2px 0 0',
                              height:`${Math.max(4,(pt.rainfall_mm/60)*100)}%`,opacity:0.65}} />
                        );
                      })}
                    </div>
                    {d.summary.critical_hours_24h > 0 && (
                      <div style={{marginTop:8,padding:'6px 10px',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,fontSize:'0.72rem',color:'var(--risk-critical)'}}>
                        ⚠️ {d.summary.critical_hours_24h} critical-rainfall hour{d.summary.critical_hours_24h!==1?'s':''} forecast in next 24h — elevated landslide risk
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── RESPONSE TAB ── */}
        {tab === 'response' && (
          <div className="fade-in">
            <div style={{fontSize:'0.65rem',color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>
              🚨 Emergency Response Prioritization — zones ranked by Risk × Exposure (road &amp; village proximity)
            </div>
            {prioLoading ? (
              <div style={{display:'flex',justifyContent:'center',padding:'24px 0'}}><div className="spinner" /></div>
            ) : !prioritization || prioritization.length === 0 ? (
              <div style={{color:'var(--text-muted)',fontSize:'0.8rem',textAlign:'center',padding:'20px 0'}}>
                ✅ No High/Critical zones requiring immediate response
              </div>
            ) : prioritization.map((z, i) => (
              <div key={`${z.grid_id}-${i}`} className="alert-item" style={{borderLeftColor: RISK_COLORS[z.risk_level]}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span className={`prio-tier tier-${z.priority_tier?.toLowerCase()}`}>{z.priority_tier}</span>
                    <span style={{fontWeight:700,fontSize:'0.82rem',fontFamily:"'Space Grotesk'"}}>{z.grid_id}</span>
                  </div>
                  <span className={`alert-badge badge-${z.risk_level?.toLowerCase()}`}>{z.risk_level}</span>
                </div>
                <div style={{marginTop:6,fontSize:'0.72rem',color:'var(--text-secondary)'}}>
                  🛣 {z.nearby_roads} &nbsp;·&nbsp; 🏘 {z.nearby_villages}
                </div>
                <div style={{marginTop:4,fontSize:'0.72rem',color:'var(--text-secondary)'}}>
                  📍 Road: {z.road_proximity_km?.toFixed(1)}km &nbsp;·&nbsp; Village: {z.village_proximity_km?.toFixed(1)}km
                </div>
                <div style={{marginTop:6,padding:'5px 8px',background:'rgba(239,68,68,0.08)',borderRadius:6,fontSize:'0.7rem',color:RISK_COLORS[z.risk_level],fontWeight:600}}>
                  ▶ {z.recommended_action}
                </div>
                <div style={{marginTop:4,display:'flex',justifyContent:'space-between',fontSize:'0.62rem',color:'var(--text-muted)'}}>
                  <span>Priority Score: {z.priority_score}</span>
                  <span>Score: {z.composite_score?.toFixed(1)}/100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
