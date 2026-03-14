import type { PeerInfo } from "@/types";

interface Props {
  peers: PeerInfo[];
}

const statusColor: Record<PeerInfo["status"], string> = {
  online: "bg-green-500",
  offline: "bg-gray-500",
  error: "bg-red-500",
};

export default function PeerStatusBar({ peers }: Props) {
  if (peers.length <= 1) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-gray-800 border-b border-gray-700 text-xs">
      <span className="text-gray-400">Peers:</span>
      {peers.map((peer) => (
        <div key={peer.id} className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${statusColor[peer.status]}`}
          />
          <span className="text-gray-300">{peer.name}</span>
        </div>
      ))}
    </div>
  );
}
