import { useApp } from '../context/AppContext.jsx';

export default function ToastContainer() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.level}`}>
          <div className="toast-icon">
            {t.level === 'critical' ? '🔴' : t.level === 'high' ? '🟠' : t.level === 'medium' ? '🟡' : '📌'}
          </div>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            <div className="toast-msg">{t.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
