/**
 * PeerJS ICE: free Google STUN by default, optional TURN from VITE_TURN_*.
 * Config-ready when a hosted TURN is added later — no code change needed.
 */

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export function buildIceServers(env: Record<string, string | undefined> = {}): IceServer[] {
  const servers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const url = String(env.VITE_TURN_URL || '').trim();
  if (!url) return servers;
  const turn: IceServer = { urls: url };
  const username = String(env.VITE_TURN_USERNAME || '').trim();
  const credential = String(env.VITE_TURN_CREDENTIAL || '').trim();
  if (username) turn.username = username;
  if (credential) turn.credential = credential;
  servers.push(turn);
  return servers;
}

export function peerIceConfig(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): {
  debug: 0;
  config: { iceServers: IceServer[] };
} {
  return {
    debug: 0,
    config: { iceServers: buildIceServers(env) },
  };
}
