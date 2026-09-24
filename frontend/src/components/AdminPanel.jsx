import { useState, useEffect } from 'react';
import { getAdminConfig, updateAdminConfig, getHealthStatus, getUsers } from '../api.js';

const WEIGHT_KEYS = ['weight_rainfall', 'weight_soil', 'weight_slope', 'weight_historical', 'weight_citizen'];
const WEIGHT_LABELS = { weight_rainfall: 'Rainfall Intensity', weight_soil: 'Soil Moisture', weight_slope: 'Slope Angle', weight_historical: 'Historical Incidents', weight_citizen: 'Citizen Reports' };
const THRESHOLD_KEYS = ['risk_threshold_medium', 'risk_threshold_high', 'risk_threshold_critical'];
const THRESHOLD_LABELS = { risk_threshold_medium: 'Medium Risk Threshold', risk_threshold_high: 'High Risk Threshold', risk_threshold_critical: 'Critical Risk Threshold' };
const THRESHOLD_COLORS = { risk_threshold_medium: '#eab308', risk_threshold_high: '#f97316', risk_threshold_critical: '#ef4444' };

const SOURCE_ICONS = { simulated: '🤖', api: '🌐', static: '📂', live: '📡', ml: '🧠' };
const SOURCE_COLORS = { Active: '#22c55e', Proxied: '#3b82f6', Simulated: '#3b82f6', Loaded: '#8b5cf6', Error: '#ef4444', Unavailable: '#f97316' };

function formatTime(ts) {
  if (!ts) return 'N/A';
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('thresholds');
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localConfig, setLocalConfig] = useState({});

  useEffect(() => {
    Promise.all([getAdminConfig(), getHealthStatus(), getUsers()]).then(([cfg, hlth, usrs]) => {
      setConfig(cfg);
      setLocalConfig({ ...cfg });
      setHealth(hlth);
      setUsers(usrs || []);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAdminConfig(localConfig);
      setConfig({ ...localConfig });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const weightSum = WEIGHT_KEYS.reduce((s, k) => s + parseFloat(localConfig[k] || 0), 0);

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <div>
            <div className="admin-title">⚙️ Admin Configuration</div>
            <div className="admin-subtitle">Manage risk thresholds, model weights, users &amp; system health</div>
          </div>
          <button className="close-btn" onClick={onClose} style={{fontSize:'1.4rem'}}>×</button>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {[['thresholds','⚖️ Thresholds & Weights'],['users','👥 Users'],['health','📡 System Health']].map(([id,label]) => (
            <button key={id} className={`admin-tab ${tab===id?'active':''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="admin-body">
          {/* ── THRESHOLDS & WEIGHTS ── */}
          {tab === 'thresholds' && (
            <div className="fade-in">
              {!localConfig || Object.keys(localConfig).length === 0 ? (
                <div style={{display:'flex',justifyContent:'center',padding:40}}><div className="spinner"/></div>
              ) : (
                <>
                  {/* Risk Thresholds */}
                  <div className="admin-section-title">🎯 Risk Level Thresholds (0–100) · SIH 26192</div>
                  <div style={{marginBottom:10,padding:'10px 14px',background:'rgba(56,189,248,0.08)',border:'1px solid rgba(56,189,248,0.3)',borderRadius:8,fontSize:'0.75rem',color:'#bae6fd'}}>
                    ⚡ <strong>XGBoost 22-Feature Engine Active (SIH 26192)</strong><br/>
                    • <strong>Decision Threshold:</strong> <code>0.460</code> (Frozen on validation)<br/>
                    • <strong>Test Results:</strong> Precision: <strong>92.28%</strong> | Recall: <strong>97.17%</strong> | F1: <strong>94.66%</strong> | Accuracy: <strong>95.87%</strong> | ROC-AUC: <strong>0.9941</strong><br/>
                    • <strong>Risk Classification:</strong> Low &lt; 28% · Moderate 28–46% · High 46–75% (Alert Trigger) · Critical ≥ 75%
                  </div>
                  {THRESHOLD_KEYS.map(k => (
                    <div key={k} className="config-row">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <label style={{fontSize:'0.82rem',fontWeight:600,color:THRESHOLD_COLORS[k]}}>{THRESHOLD_LABELS[k]}</label>
                        <span className="config-val-badge" style={{background:`${THRESHOLD_COLORS[k]}22`,color:THRESHOLD_COLORS[k]}}>
                          {parseFloat(localConfig[k]).toFixed(0)}
                        </span>
                      </div>
                      <input type="range" min="5" max="95" step="1"
                        value={parseFloat(localConfig[k]) || 0}
                        onChange={e => setLocalConfig(c => ({...c, [k]: e.target.value}))}
                        className="config-slider"
                        style={{'--thumb-color': THRESHOLD_COLORS[k]}}
                      />
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.62rem',color:'var(--text-muted)'}}>
                        <span>5</span><span>50</span><span>95</span>
                      </div>
                    </div>
                  ))}

                  {/* Model Weights */}
                  <div className="admin-section-title" style={{marginTop:20}}>
                    📊 Model Factor Weights
                    <span style={{marginLeft:8,fontSize:'0.68rem',color: Math.abs(weightSum-1.0)>0.01?'var(--risk-high)':'var(--risk-low)'}}>
                      Sum: {weightSum.toFixed(2)} {Math.abs(weightSum-1.0)>0.01?'⚠️ (should be 1.0)':'✓'}
                    </span>
                  </div>
                  {WEIGHT_KEYS.map(k => (
                    <div key={k} className="config-row">
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <label style={{fontSize:'0.82rem',fontWeight:500,color:'var(--text-secondary)'}}>{WEIGHT_LABELS[k]}</label>
                        <span className="config-val-badge">{(parseFloat(localConfig[k])||0).toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="0.7" step="0.01"
                        value={parseFloat(localConfig[k]) || 0}
                        onChange={e => setLocalConfig(c => ({...c, [k]: e.target.value}))}
                        className="config-slider"
                      />
                      <div style={{height:4,background:'var(--border)',borderRadius:2,marginTop:4}}>
                        <div style={{height:'100%',width:`${(parseFloat(localConfig[k])/0.7)*100}%`,background:'var(--accent-blue)',borderRadius:2,transition:'width 0.2s'}}/>
                      </div>
                    </div>
                  ))}

                  <button className="save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Changes'}
                  </button>
                  {saved && <div style={{fontSize:'0.72rem',color:'var(--risk-low)',textAlign:'center',marginTop:8}}>Changes will take effect on next risk recompute</div>}
                </>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="fade-in">
              <div className="admin-section-title">👥 Registered Users</div>
              {users.length === 0 ? (
                <div style={{display:'flex',justifyContent:'center',padding:40}}><div className="spinner"/></div>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>District</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{fontWeight:600,fontSize:'0.82rem'}}>{u.name}</div>
                          <div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{u.id}</div>
                        </td>
                        <td>
                          <span className={`role-badge role-${u.role}`}>{u.role?.replace('_',' ')}</span>
                        </td>
                        <td style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{u.district || '—'}</td>
                        <td style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{u.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{marginTop:12,padding:'10px 14px',background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.2)',borderRadius:8,fontSize:'0.72rem',color:'var(--text-secondary)'}}>
                ⚠️ Role-based access control is defined in the data model above (roles: citizen, field_officer, district_officer, analyst, admin) but is not yet enforced at the API layer in this prototype. Planned for production deployment per PRD NFR — Security. Citizen data is handled with care per the parent PRD.
              </div>
            </div>
          )}

          {/* ── SYSTEM HEALTH ── */}
          {tab === 'health' && (
            <div className="fade-in">
              {!health ? (
                <div style={{display:'flex',justifyContent:'center',padding:40}}><div className="spinner"/></div>
              ) : (
                <>
                  <div className="admin-section-title">📡 Data Source Status</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                    {health.sources?.map(s => (
                      <div key={s.name} className="health-card">
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:'1.1rem'}}>{SOURCE_ICONS[s.type] || '📊'}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'0.82rem',fontWeight:600}}>{s.name}</div>
                            <div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>Last sync: {formatTime(s.last_sync)}</div>
                          </div>
                          <span className="health-badge" style={{background:`${SOURCE_COLORS[s.status] || '#3b82f6'}22`,color:SOURCE_COLORS[s.status] || '#3b82f6'}}>
                            {s.status === 'Active' ? '🟢' : (s.status === 'Proxied' || s.status === 'Simulated') ? '🔵' : s.status === 'Loaded' ? '🟣' : '🔴'} {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="admin-section-title">📈 System Statistics</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {[
                      ['Sensor Readings', health.stats?.total_readings || 0, '🌡'],
                      ['Field Reports', health.stats?.total_reports || 0, '📋'],
                      ['Active Alerts', health.stats?.active_alerts || 0, '🔔'],
                      ['Last Risk Compute', formatTime(health.stats?.last_risk_compute), '⚡'],
                    ].map(([label, val, icon]) => (
                      <div key={label} className="health-stat-card">
                        <div style={{fontSize:'1.1rem'}}>{icon}</div>
                        <div style={{fontSize:'1.2rem',fontWeight:800,fontFamily:"'Space Grotesk'"}}>{val}</div>
                        <div style={{fontSize:'0.65rem',color:'var(--text-muted)'}}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* ML Model Detail Card */}
                  {(() => {
                    const mlSrc = health.sources?.find(s => s.type === 'ml');
                    if (!mlSrc) return null;
                    return (
                      <div style={{marginTop:16}}>
                        <div className="admin-section-title">🧠 ML Model Info</div>
                        <div style={{padding:'12px 16px',background:'rgba(139,92,246,0.08)',border:'1px solid rgba(139,92,246,0.25)',borderRadius:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                            <div style={{fontSize:'0.85rem',fontWeight:700,color:'#a78bfa'}}>XGBoost Landslide Risk Model v2</div>
                            <span style={{fontSize:'0.7rem',padding:'2px 8px',borderRadius:20,background:mlSrc.status==='Active'?'rgba(34,197,94,0.15)':'rgba(249,115,22,0.15)',color:mlSrc.status==='Active'?'#22c55e':'#f97316',fontWeight:600}}>
                              {mlSrc.status === 'Active' ? '🟢 Active' : '🟠 Unavailable (Fallback)'}
                            </span>
                          </div>
                          {mlSrc.status === 'Active' && (
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                              {[
                                ['ROC-AUC', mlSrc.roc_auc ? (mlSrc.roc_auc * 100).toFixed(1) + '%' : 'N/A'],
                                ['Accuracy', mlSrc.accuracy ? (mlSrc.accuracy * 100).toFixed(1) + '%' : 'N/A'],
                                ['Recall', mlSrc.recall ? (mlSrc.recall * 100).toFixed(1) + '%' : 'N/A'],
                              ].map(([lbl, val]) => (
                                <div key={lbl} style={{textAlign:'center',padding:'6px 8px',background:'rgba(255,255,255,0.04)',borderRadius:6}}>
                                  <div style={{fontSize:'0.85rem',fontWeight:800,color:'#e2e8f0'}}>{val}</div>
                                  <div style={{fontSize:'0.62rem',color:'var(--text-muted)'}}>{lbl}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Model Caveats — always visible per PRD §9 */}
                          <div style={{fontSize:'0.7rem',fontWeight:600,color:'#fbbf24',marginBottom:4}}>⚠️ Model Caveats (PRD §9)</div>
                          <ul style={{margin:0,paddingLeft:16,display:'flex',flexDirection:'column',gap:3}}>
                            {(mlSrc.caveats || [
                              'Dataset is a 2024 prototype; validation is internal only.',
                              'Reported metrics are NOT evidence of real-world performance.',
                              'Temporal provenance of historical_landslide_density unconfirmed.',
                              'Risk-bucket thresholds must be re-validated against real incidents.',
                            ]).map((c, i) => (
                              <li key={i} style={{fontSize:'0.68rem',color:'var(--text-secondary)',lineHeight:1.5}}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
