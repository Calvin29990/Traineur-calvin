import { useCallback, useEffect, useRef, useState } from 'react';

let toastSeq = 0;

export function useSocket() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const sessionRef = useRef(localStorage.getItem('tl.session') || null);
  const retryRef = useRef(0);
  const queueRef = useRef([]);
  const aliveRef = useRef(true);

  const notify = useCallback((text, kind = '') => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const connect = useCallback(() => {
    if (!aliveRef.current) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', sessionId: sessionRef.current }));
      const q = queueRef.current;
      queueRef.current = [];
      q.forEach((m) => ws.send(m));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'state') setState(msg.data);
      else if (msg.type === 'joined') {
        sessionRef.current = msg.sessionId;
        localStorage.setItem('tl.session', msg.sessionId);
      } else if (msg.type === 'error') notify(msg.message, 'err');
    };

    ws.onclose = () => {
      setConnected(false);
      if (!aliveRef.current) return;
      retryRef.current += 1;
      setTimeout(connect, Math.min(4000, 400 * retryRef.current));
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }, [notify]);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      try { wsRef.current?.close(); } catch { /* ignore */ }
    };
  }, [connect]);

  const send = useCallback((msg) => {
    const raw = JSON.stringify(msg);
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) ws.send(raw);
    else queueRef.current.push(raw);
  }, []);

  const resetSession = useCallback(() => {
    localStorage.removeItem('tl.session');
    sessionRef.current = null;
    try { wsRef.current?.close(); } catch { /* ignore */ }
    setState(null);
    setTimeout(() => connect(), 200);
  }, [connect]);

  return { state, connected, send, notify, toasts, resetSession };
}
