import { useApp } from '../context/AppContext.jsx';

const NAV_ITEMS = [
  ['⌂', 'Overview'], ['⌁', 'Live Map'], ['▦', 'Risk Zones'],
  ['▤', 'Field Reports'], ['⌂', 'Shelters & Roads'], ['!', 'Alerts'], ['☁', 'Weather'], ['↗', 'Response'],
];

export default function Sidebar() {
  const { alerts, users, activeView, navigate, serviceStatus } = useApp();
  const activeAlerts = alerts.filter(alert => alert.status === 'Active');
  const role = users[0]?.role;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">NAVIGATION</div>
      <nav className="nav-list" aria-label="Primary navigation">
        {NAV_ITEMS.map(([icon, label]) => (
          <button key={label} className={`nav-item ${activeView === label ? 'active' : ''}`} onClick={() => navigate(label)}>
            <span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span>
            {label === 'Alerts' && activeAlerts.length > 0 && <b className="nav-count">{activeAlerts.length}</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer"><span className={`status-dot status-${serviceStatus.state}`} /> {serviceStatus.label}<span className="sidebar-role">{role?.replaceAll('_', ' ') || 'role loading'}</span></div>
    </aside>
  );
}
