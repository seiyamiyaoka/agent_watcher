import { useState, useEffect } from "react";
import type { PeerInfo, SessionSummary } from "@/types";

const PEER_POLL_INTERVAL = 10_000;
const TEAM_POLL_INTERVAL = 5_000;

export function usePeers() {
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchPeers = () => {
      fetch("/api/peers")
        .then((res) => res.json())
        .then((data: PeerInfo[]) => {
          if (active) setPeers(data);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    fetchPeers();
    const timer = setInterval(fetchPeers, PEER_POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { peers, loading };
}

export function useTeamSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchSessions = () => {
      fetch("/api/peers/sessions")
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
    const timer = setInterval(fetchSessions, TEAM_POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { sessions, loading };
}
