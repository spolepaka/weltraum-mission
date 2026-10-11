/**
 * PeerJS loads only when the Online menu opens — not on a guest map visit.
 */
import { importFresh } from './chunk-update';
export type PeerCtor = new (id?: string | object, opts?: object) => {
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
  connect: (id: string, opts?: object) => unknown;
  destroy: () => void;
  reconnect: () => void;
  id?: string;
};

export async function loadPeerConstructor(): Promise<PeerCtor> {
  const mod = await importFresh(() => import('peerjs'));
  const Peer = (mod as { default?: PeerCtor; Peer?: PeerCtor }).default
    || (mod as { Peer?: PeerCtor }).Peer;
  if (!Peer) throw new Error('peerjs_unavailable');
  return Peer;
}

export const PEER_ICE = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
} as const;
