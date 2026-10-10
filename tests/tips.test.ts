import { describe, expect, it } from 'vitest';
import {
  canShowTip,
  dismissTip,
  loadTips,
  markTipShown,
  pickMapTip,
  TIP_MAX_SHOWS,
  type TipsState,
} from '../src/lib/tips';

function fresh(): TipsState {
  return {
    shown: {},
    dismissed: {},
    lastMapTip: null,
    mapVisits: 1,
    onboardDone: true,
    lossesByLevel: {},
    lastLossLevel: null,
    coinsSeen: false,
    visitHadTip: false,
  };
}

describe('coach tips', () => {
  it('picks shop tip when the player can afford a ship', () => {
    const id = pickMapTip(fresh(), {
      coins: 370,
      canAffordShip: true,
      unlocked: 2,
      lastLossLevel: null,
      lossesOnLevel: 0,
      missionsReady: false,
      ghostOn: false,
      finishedCount: 1,
    });
    expect(id).toBe('shopCoins');
  });

  it('suggests the shop after two losses on the same level', () => {
    const id = pickMapTip(fresh(), {
      coins: 10,
      canAffordShip: false,
      unlocked: 2,
      lastLossLevel: 2,
      lossesOnLevel: 2,
      missionsReady: false,
      ghostOn: false,
      finishedCount: 0,
    });
    expect(id).toBe('afterLosses');
  });

  it('does not repeat a dismissed tip or a second tip in the same visit', () => {
    let st = markTipShown(fresh(), 'shopCoins');
    expect(pickMapTip(st, {
      coins: 400, canAffordShip: true, unlocked: 4, lastLossLevel: null,
      lossesOnLevel: 0, missionsReady: true, ghostOn: true, finishedCount: 3,
    })).toBeNull();
    st = { ...st, visitHadTip: false };
    st = dismissTip(st, 'shopCoins');
    expect(canShowTip(st, 'shopCoins')).toBe(false);
    expect(st.shown.shopCoins).toBe(TIP_MAX_SHOWS);
  });

  it('loads empty tip state when storage is missing', () => {
    const store: Record<string, string> = {};
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const key of Object.keys(store)) delete store[key]; },
      key: () => null,
      length: 0,
    } as Storage;
    expect(loadTips().onboardDone).toBe(false);
  });
});
