import { useEffect, useRef, useCallback, useState } from "react";
import type { WSMessage } from "../types";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 16000;

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the hook should be actively connecting
  const activeRef = useRef(false);

  const connect = useCallback((sid: string) => {
    if (!activeRef.current) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/${sid}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect with exponential backoff
      if (activeRef.current) {
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, retriesRef.current),
          RECONNECT_MAX_DELAY
        );
        retriesRef.current += 1;
        timerRef.current = setTimeout(() => connect(sid), delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, which handles reconnection
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as WSMessage;
        setLastMessage(data);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      activeRef.current = false;
      return;
    }

    activeRef.current = true;
    retriesRef.current = 0;
    connect(sessionId);

    return () => {
      activeRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [sessionId, connect]);

  const send = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type, payload }));
      }
    },
    []
  );

  return { lastMessage, connected, send };
}
