/**
 * PeerJS loads only when the Online menu opens — not on a guest map visit.
 */
import { importFresh } from './chunk-update';
import { peerIceConfig } from './peer-ice';
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

export const PEER_ICE = peerIceConfig();
