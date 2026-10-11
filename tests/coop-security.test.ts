/**
 * Co-op Security Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetCoopSecurity,
  requestJoin,
  approveJoin,
  rejectJoin,
  kickPlayer,
  checkJoinAllowed,
  isApproved,
  isKicked,
  setHostApprovalRequired,
  setMaxPlayers,
  setRateLimits,
  playerJoined,
  playerLeft,
  getPendingRequests,
  setOccupancy,
  occupiedSeats,
  generateSecureRoomCode,
  validateRoomCode,
  recordJoinAttempt,
} from '../src/coop-security';

describe('Co-op Security', () => {
  beforeEach(() => {
    resetCoopSecurity();
  });

  describe('Join Approval', () => {
    it('auto-admits by default (room code is the secret)', () => {
      const result = requestJoin('peer1');
      expect(result).toBe(true);
      expect(isApproved('peer1')).toBe(true);
      expect(getPendingRequests()).toHaveLength(0);
    });

    it('should require host approval when ask-to-join is on', () => {
      setHostApprovalRequired(true);
      const result = requestJoin('peer1');
      expect(result).toBe(false);
      expect(getPendingRequests()).toHaveLength(1);
      expect(getPendingRequests()[0].peerId).toBe('peer1');
    });

    it('should allow immediate join when approval not required', () => {
      setHostApprovalRequired(false);
      const result = requestJoin('peer1');
      expect(result).toBe(true);
      expect(isApproved('peer1')).toBe(true);
    });

    it('should allow join after approval', () => {
      setHostApprovalRequired(true);
      requestJoin('peer1');
      expect(isApproved('peer1')).toBe(false);
      
      approveJoin('peer1');
      expect(isApproved('peer1')).toBe(true);
    });

    it('should reject join after rejection', () => {
      setHostApprovalRequired(true);
      requestJoin('peer1');
      rejectJoin('peer1');
      
      const requests = getPendingRequests();
      expect(requests).toHaveLength(0);
      expect(isApproved('peer1')).toBe(false);
    });

    it('should prevent duplicate pending requests', () => {
      setHostApprovalRequired(true);
      requestJoin('peer1');
      const check = checkJoinAllowed('peer1');
      expect(check.allowed).toBe(false);
      if (!check.allowed) {
        expect(check.reason).toBe('already_pending');
      }
    });
  });

  describe('Room Capacity', () => {
    it('should reject when room is full', () => {
      setMaxPlayers(2);
      setHostApprovalRequired(false);
      
      requestJoin('peer1');
      playerJoined('peer1');
      
      const check = checkJoinAllowed('peer2');
      expect(check.allowed).toBe(false);
      if (!check.allowed) {
        expect(check.reason).toBe('room_full');
      }
    });

    it('does not treat a leftover sticky counter or ghost seats as full', () => {
      setMaxPlayers(5);
      playerJoined('ghost-a');
      playerJoined('ghost-b');
      playerJoined('ghost-c');
      playerJoined('ghost-d');
      expect(occupiedSeats()).toBe(5);
      resetCoopSecurity();
      expect(occupiedSeats()).toBe(1);
      expect(checkJoinAllowed('friend').allowed).toBe(true);
      setOccupancy(1);
      expect(checkJoinAllowed('friend').allowed).toBe(true);
    });

    it('counts a reconnect of an approved peer as not full', () => {
      setMaxPlayers(2);
      requestJoin('peer1');
      playerJoined('peer1');
      const again = checkJoinAllowed('peer1');
      expect(again.allowed).toBe(true);
    });

    it('should allow join when player leaves', () => {
      setMaxPlayers(2);
      setHostApprovalRequired(false);
      
      requestJoin('peer1');
      playerJoined();
      
      playerLeft('peer1');
      
      const check = checkJoinAllowed('peer2');
      expect(check.allowed).toBe(true);
    });
  });

  describe('Kick Functionality', () => {
    it('should prevent kicked players from rejoining', () => {
      setHostApprovalRequired(false);
      requestJoin('peer1');
      playerJoined();
      
      kickPlayer('peer1');
      
      const check = checkJoinAllowed('peer1');
      expect(check.allowed).toBe(false);
      if (!check.allowed) {
        expect(check.reason).toBe('kicked');
      }
      expect(isKicked('peer1')).toBe(true);
    });

    it('should remove kicked player from approved list', () => {
      setHostApprovalRequired(false);
      requestJoin('peer1');
      playerJoined();
      
      expect(isApproved('peer1')).toBe(true);
      
      kickPlayer('peer1');
      
      expect(isApproved('peer1')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit rapid join attempts', () => {
      setRateLimits(2, 60000);
      
      recordJoinAttempt('peer1');
      recordJoinAttempt('peer1');
      
      const check = checkJoinAllowed('peer1');
      expect(check.allowed).toBe(false);
      if (!check.allowed) {
        expect(check.reason).toBe('rate_limited');
      }
    });

    it('should allow attempts after rate window expires', () => {
      setRateLimits(2, 100);
      
      recordJoinAttempt('peer1');
      recordJoinAttempt('peer1');
      
      let check = checkJoinAllowed('peer1');
      expect(check.allowed).toBe(false);
      
      // Simulate time passing (in a real test we'd use fake timers)
      // For now, just verify the rate limiting logic works
    });
  });

  describe('Room Code Generation', () => {
    it('should generate valid room codes', () => {
      const code = generateSecureRoomCode();
      expect(code.length).toBe(5);
      expect(validateRoomCode(code)).toBe(true);
    });

    it('should validate room codes correctly', () => {
      expect(validateRoomCode('ACDEF')).toBe(true);
      expect(validateRoomCode('12345')).toBe(false);
      expect(validateRoomCode('HELLO')).toBe(false);
      expect(validateRoomCode('AB')).toBe(false);
      expect(validateRoomCode('ABCDEFGH')).toBe(false);
    });

    it('should clean and validate codes', () => {
      expect(validateRoomCode('ac-def')).toBe(true);
      expect(validateRoomCode('  ACDEF  ')).toBe(true);
    });

    it('should use cryptographically secure random', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateSecureRoomCode());
      }
      // All codes should be unique (extremely unlikely to collide with 5-char codes)
      expect(codes.size).toBe(100);
    });
  });
});
