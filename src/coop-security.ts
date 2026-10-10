/**
 * Co-op Security Module
 * Implements host approval, join rate limiting, and kick functionality
 */

export interface JoinRequest {
  peerId: string;
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface CoopSecurityState {
  joinRequests: Map<string, JoinRequest>;
  joinAttempts: Map<string, number[]>;
  approvedPeers: Set<string>;
  kickedPeers: Set<string>;
  maxPlayers: number;
  currentPlayers: number;
  hostApprovalRequired: boolean;
  joinRateLimit: number;
  joinRateWindow: number;
}

const DEFAULT_STATE: Omit<CoopSecurityState, 'joinRequests' | 'joinAttempts' | 'approvedPeers' | 'kickedPeers'> = {
  maxPlayers: 5,
  currentPlayers: 1,
  hostApprovalRequired: false,
  joinRateLimit: 3,
  joinRateWindow: 60000,
};

let state: CoopSecurityState = {
  ...DEFAULT_STATE,
  joinRequests: new Map(),
  joinAttempts: new Map(),
  approvedPeers: new Set(),
  kickedPeers: new Set(),
};

let onJoinRequestCallback: ((request: JoinRequest) => void) | null = null;
let onApprovalCallback: ((peerId: string, approved: boolean) => void) | null = null;
let onKickCallback: ((peerId: string) => void) | null = null;

export function resetCoopSecurity(): void {
  state = {
    ...DEFAULT_STATE,
    joinRequests: new Map(),
    joinAttempts: new Map(),
    approvedPeers: new Set(),
    kickedPeers: new Set(),
  };
}

export function setHostApprovalRequired(required: boolean): void {
  state.hostApprovalRequired = required;
}

export function setMaxPlayers(max: number): void {
  state.maxPlayers = Math.max(2, Math.min(5, max));
}

export function setRateLimits(limit: number, windowMs: number): void {
  state.joinRateLimit = limit;
  state.joinRateWindow = windowMs;
}

export function onJoinRequest(callback: (request: JoinRequest) => void): () => void {
  onJoinRequestCallback = callback;
  return () => { onJoinRequestCallback = null; };
}

export function onApproval(callback: (peerId: string, approved: boolean) => void): () => void {
  onApprovalCallback = callback;
  return () => { onApprovalCallback = null; };
}

export function onKick(callback: (peerId: string) => void): () => void {
  onKickCallback = callback;
  return () => { onKickCallback = null; };
}

export type JoinCheckResult = 
  | { allowed: true }
  | { allowed: false; reason: 'kicked' | 'rate_limited' | 'room_full' | 'already_pending' };

export function checkJoinAllowed(peerId: string): JoinCheckResult {
  if (state.kickedPeers.has(peerId)) {
    return { allowed: false, reason: 'kicked' };
  }

  if (state.currentPlayers >= state.maxPlayers) {
    return { allowed: false, reason: 'room_full' };
  }

  const now = Date.now();
  const attempts = state.joinAttempts.get(peerId) || [];
  const recentAttempts = attempts.filter(t => now - t < state.joinRateWindow);
  
  if (recentAttempts.length >= state.joinRateLimit) {
    return { allowed: false, reason: 'rate_limited' };
  }

  const existingRequest = state.joinRequests.get(peerId);
  if (existingRequest && existingRequest.status === 'pending') {
    return { allowed: false, reason: 'already_pending' };
  }

  return { allowed: true };
}

export function recordJoinAttempt(peerId: string): void {
  const now = Date.now();
  const attempts = state.joinAttempts.get(peerId) || [];
  attempts.push(now);
  const recentAttempts = attempts.filter(t => now - t < state.joinRateWindow);
  state.joinAttempts.set(peerId, recentAttempts);
}

export function requestJoin(peerId: string): boolean {
  const check = checkJoinAllowed(peerId);
  recordJoinAttempt(peerId);

  if (!check.allowed) {
    console.log('[CoopSecurity] Join rejected:', peerId, check.reason);
    return false;
  }

  if (state.approvedPeers.has(peerId)) {
    return true;
  }

  if (!state.hostApprovalRequired) {
    state.approvedPeers.add(peerId);
    return true;
  }

  const request: JoinRequest = {
    peerId,
    timestamp: Date.now(),
    status: 'pending',
  };
  
  state.joinRequests.set(peerId, request);
  
  if (onJoinRequestCallback) {
    onJoinRequestCallback(request);
  }

  return false;
}

export function approveJoin(peerId: string): boolean {
  const request = state.joinRequests.get(peerId);
  if (!request || request.status !== 'pending') {
    return false;
  }

  if (state.currentPlayers >= state.maxPlayers) {
    request.status = 'rejected';
    if (onApprovalCallback) {
      onApprovalCallback(peerId, false);
    }
    return false;
  }

  request.status = 'approved';
  state.approvedPeers.add(peerId);
  
  if (onApprovalCallback) {
    onApprovalCallback(peerId, true);
  }

  return true;
}

export function rejectJoin(peerId: string): void {
  const request = state.joinRequests.get(peerId);
  if (request) {
    request.status = 'rejected';
  }
  
  if (onApprovalCallback) {
    onApprovalCallback(peerId, false);
  }
}

export function kickPlayer(peerId: string): void {
  state.kickedPeers.add(peerId);
  state.approvedPeers.delete(peerId);
  state.joinRequests.delete(peerId);
  
  if (onKickCallback) {
    onKickCallback(peerId);
  }
}

export function playerJoined(): void {
  state.currentPlayers++;
}

export function playerLeft(peerId: string): void {
  state.currentPlayers = Math.max(1, state.currentPlayers - 1);
  state.approvedPeers.delete(peerId);
  state.joinRequests.delete(peerId);
}

export function isApproved(peerId: string): boolean {
  return state.approvedPeers.has(peerId);
}

export function isKicked(peerId: string): boolean {
  return state.kickedPeers.has(peerId);
}

export function getPendingRequests(): JoinRequest[] {
  return Array.from(state.joinRequests.values()).filter(r => r.status === 'pending');
}

export function getState(): Readonly<CoopSecurityState> {
  return state;
}

/** Same alphabet the PeerJS lobby uses (no 0/1/I/O/B/G/S). */
export const ROOM_CODE_CHARS = 'ACDEFHJKMNPRTUVWXY34679';

export function generateSecureRoomCode(length = 5): string {
  const chars = ROOM_CODE_CHARS;
  let code = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

export function validateRoomCode(code: string): boolean {
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleanCode.length >= 4 && cleanCode.length <= 6 && cleanCode.split('').every(ch => ROOM_CODE_CHARS.includes(ch));
}
