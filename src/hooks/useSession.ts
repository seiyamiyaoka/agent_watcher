import { useState, useEffect, useCallback, useRef } from "react";
import type { SessionSummary, SessionData } from "@/types";

const POLL_INTERVAL = 3000;

export function useSessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSessions = () => {
      fetch("/api/sessions")
        .then((res) => res.json())
        .then((data: SessionSummary[]) => {
          if (active) setSessions(data);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    fetchSessions();
    const timer = setInterval(fetchSessions, POLL_INTERVAL * 5);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { sessions, loading };
}

export function useSessionData(sessionId: string | null, peerId?: string | null) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const prevKeyRef = useRef<string | null>(null);

  const fetchSession = useCallback(
    (id: string, peer: string | null | undefined, isInitial: boolean) => {
      if (isInitial) setLoading(true);

      const url =
        peer && peer !== "local"
          ? `/api/peers/${peer}/sessions/${id}`
          : `/api/sessions/${id}`;

      fetch(url)
        .then((res) => res.json())
        .then((d: SessionData) => setData(d))
        .catch(() => {
          if (isInitial) setData(null);
        })
        .finally(() => {
          if (isInitial) setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      prevKeyRef.current = null;
      return;
    }

    const key = `${peerId ?? "local"}:${sessionId}`;
    const isNew = key !== prevKeyRef.current;
    prevKeyRef.current = key;
    fetchSession(sessionId, peerId, isNew);

    const timer = setInterval(
      () => fetchSession(sessionId, peerId, false),
      POLL_INTERVAL,
    );
    return () => clearInterval(timer);
  }, [sessionId, peerId, fetchSession]);

  return { data, loading };
}
