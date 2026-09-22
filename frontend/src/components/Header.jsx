import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import AdminPanel from './AdminPanel.jsx';

const LANG_LABELS = { en: 'EN', hi: 'हि', mz: 'MZ' };

export default function Header() {
  const { language, setLanguage, summary, alerts } = useApp();
  const [showAdmin, setShowAdmin] = useState(false);
  const activeAlerts = alerts.filter(a => a.status === 'Active');
  const criticalCount = activeAlerts.filter(a => a.risk_level === 'Critical').length;

  return (
    <>
      <header className="header">
        <div className="header-logo">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4L36 32H4L20 4Z" fill="#ef4444" opacity="0.8"/>
            <path d="M20 12L30 28H10L20 12Z" fill="#f97316" opacity="0.8"/>
            <circle cx="20" cy="22" r="3" fill="#fbbf24"/>
            <path d="M2 36h36" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="header-title">
              NER Landslide Warning System
              <span>MDoNER · Problem Statement 26001 · Pilot: Sikkim</span>
            </div>
          </div>
        </div>
        <div className="header-spacer" />
        <div className="header-pills">
          {criticalCount > 0 && (
            <span className="pill badge-critical pill-pulse">⚡ {criticalCount} CRITICAL</span>
          )}
          {activeAlerts.length > 0 && (
            <span className="pill badge-high">{activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}</span>
          )}
          {summary && (
            <span className="pill" style={{background:'var(--border)', color:'var(--text-secondary)'}}>
              🌧 Last refresh: {new Date(summary.last_updated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{display:'flex', gap:'4px', marginLeft:'12px'}}>
          {Object.entries(LANG_LABELS).map(([code, label]) => (
            <button key={code} className={`lang-btn ${language === code ? 'active' : ''}`} onClick={() => setLanguage(code)}>
              {label}
            </button>
          ))}
        </div>
        <button
          id="admin-panel-btn"
          className="admin-open-btn"
          onClick={() => setShowAdmin(true)}
          title="Admin Configuration"
        >
          ⚙️ Admin
        </button>
      </header>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </>
  );
}
