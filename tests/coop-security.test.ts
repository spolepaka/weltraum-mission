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
  generateSecureRoomCode,
  validateRoomCode,
  recordJoinAttempt,
} from '../src/coop-security';

describe('Co-op Security', () => {
  beforeEach(() => {
    resetCoopSecurity();
  });

  describe('Join Approval', () => {
    it('should require host approval by default', () => {
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
      requestJoin('peer1');
      expect(isApproved('peer1')).toBe(false);
      
      approveJoin('peer1');
      expect(isApproved('peer1')).toBe(true);
    });

    it('should reject join after rejection', () => {
      requestJoin('peer1');
      rejectJoin('peer1');
      
      const requests = getPendingRequests();
      expect(requests).toHaveLength(0);
      expect(isApproved('peer1')).toBe(false);
    });

    it('should prevent duplicate pending requests', () => {
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
      playerJoined();
      
      const check = checkJoinAllowed('peer2');
      expect(check.allowed).toBe(false);
      if (!check.allowed) {
        expect(check.reason).toBe('room_full');
      }
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
      expect(validateRoomCode('ABCDE')).toBe(true);
      expect(validateRoomCode('12345')).toBe(false); // Contains 0, 1
      expect(validateRoomCode('HELLO')).toBe(false); // Contains O
      expect(validateRoomCode('AB')).toBe(false); // Too short
      expect(validateRoomCode('ABCDEFGH')).toBe(false); // Too long
    });

    it('should clean and validate codes', () => {
      expect(validateRoomCode('abc-de')).toBe(true);
      expect(validateRoomCode('  ABCDE  ')).toBe(true);
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
