import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getRiskScores, getRiskSummary, getActiveAlerts, getReports } from '../api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [language, setLanguage] = useState('en');
  const [riskScores, setRiskScores] = useState([]);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [layers, setLayers] = useState({ heatmap: true, zones: true, roads: false, villages: true, alerts: true, reports: true });
  const wsRef = useRef(null);
  const prevAlertIds = useRef(new Set());

  const toastSeq = useRef(0);

  const addToast = useCallback((toast) => {
    toastSeq.current += 1;
    const id = `${Date.now()}-${toastSeq.current}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(t => [{ ...toast, id }, ...t].slice(0, 5));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [scores, sum, acts, reps] = await Promise.all([
        getRiskScores(), getRiskSummary(), getActiveAlerts(), getReports()
      ]);
      setRiskScores(scores || []);
      setSummary(sum);

      // Detect new alerts
      const newAlerts = (acts || []).filter(a => !prevAlertIds.current.has(a.id));
      for (const a of newAlerts) {
        addToast({ level: a.risk_level?.toLowerCase(), title: `${a.risk_level} Alert`, msg: a.message_en });
        prevAlertIds.current.add(a.id);
      }
      setAlerts(acts || []);
      setReports(reps || []);
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Initial fetch
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // WebSocket for real-time updates
  useEffect(() => {
    let active = true;
    let reconnectTimer = null;
    let wsInstance = null;

    const connect = () => {
      if (!active) return;
      try {
        const ws = new WebSocket(`ws://localhost:3001`);
        wsInstance = ws;
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) {
            try { ws.close(); } catch {}
          }
        };

        ws.onmessage = (e) => {
          if (!active) return;
          try {
            const { type, data } = JSON.parse(e.data);
            if (type === 'RISK_UPDATE') {
              fetchAll();
            } else if (type === 'NEW_REPORT') {
              setReports(r => [data, ...r]);
              addToast({ level: 'info', title: 'New Field Report', msg: `${data.report_type} reported at (${data.lat?.toFixed(3)}, ${data.lng?.toFixed(3)})` });
            } else if (type === 'ALERT_UPDATE') {
              setAlerts(a => a.map(x => x.id === data.id ? data : x));
            }
          } catch {}
        };

        ws.onclose = () => {
          if (active) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          // Handled quietly
        };
      } catch {
        if (active) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      }
    };

    connect();
    // Poll every 2 minutes as fallback
    const poll = setInterval(fetchAll, 120000);

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(poll);
      if (wsInstance) {
        if (wsInstance.readyState === WebSocket.OPEN) {
          try { wsInstance.close(); } catch {}
        } else if (wsInstance.readyState === WebSocket.CONNECTING) {
          wsInstance.onopen = () => {
            try { wsInstance.close(); } catch {}
          };
          wsInstance.onclose = null;
          wsInstance.onerror = null;
        }
      }
    };
  }, [fetchAll, addToast]);

  const toggleLayer = (key) => setLayers(l => ({ ...l, [key]: !l[key] }));

  return (
    <AppContext.Provider value={{ language, setLanguage, riskScores, summary, alerts, reports, selectedZone, setSelectedZone, loading, toasts, layers, toggleLayer, fetchAll, addToast }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
