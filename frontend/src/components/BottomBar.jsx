import { useApp } from '../context/AppContext.jsx';

export default function BottomBar() {
  const { summary, riskScores, alerts } = useApp();
  const active = alerts.filter(a => a.status === 'Active');
  const critical = riskScores.filter(s => s.risk_level === 'Critical').length;

  return (
    <div className="bottom-bar">
      <span><span className="dot" style={{background: critical > 0 ? 'var(--risk-critical)' : 'var(--risk-low)'}} /> Live · WebSocket</span>
      <span>📍 {riskScores.length} grid zones monitored</span>
      <span>🔔 {active.length} active alert{active.length !== 1 ? 's' : ''}</span>
      <span>🏔 Pilot: East & West Sikkim</span>
      <span>📡 Data: Simulated sensors + OpenWeather proxy</span>
      <div style={{flex:1}} />
      <span style={{color:'var(--text-muted)'}}>MDoNER Problem Statement 26001 · Prototype v1.0</span>
    </div>
  );
}
