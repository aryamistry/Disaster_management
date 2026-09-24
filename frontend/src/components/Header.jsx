import { useApp } from '../context/AppContext.jsx';

export default function Header() {
  const { language, setLanguage, alerts, users, navigate } = useApp();
  const activeAlerts = alerts.filter(a => a.status === 'Active');
  const rawRole = users[0]?.role;
  const role = rawRole === 'admin' ? 'Administrator' : rawRole?.replaceAll('_', ' ') || 'role unavailable';
  const initials = users[0]?.name?.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '--';

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
            <div className="header-title">DHARA AI<span>Dynamic Hazard Assessment &amp; Risk Alerts</span></div>
          </div>
        </div>
        <div className="header-spacer" />
        <div className="helpline-strip"><strong>Emergency</strong><span>112</span><span>Ambulance <b>108</b></span><span>State <b>1070</b></span><span>Control <b>1077</b></span><span>Police <b>100</b></span></div>
        <div className="header-actions">
          <select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">EN</option><option value="hi">HI</option><option value="mz">MZ</option></select>
          <button className="icon-button" aria-label={`Notifications, ${activeAlerts.length} active alerts`} title="Open alerts" onClick={() => navigate('Alerts')}>♢{activeAlerts.length > 0 && <span>{activeAlerts.length}</span>}</button>
          <button className="user-chip user-chip-button" onClick={() => navigate('Admin')} title="Open Admin settings" aria-label="Open Admin settings">
            <span className="avatar">{initials}</span><span>{role}</span>
          </button>
        </div>
      </header>
    </>
  );
}
