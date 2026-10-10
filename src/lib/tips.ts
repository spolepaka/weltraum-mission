export const TIPS_KEY = 'spaceMissionTipsV1';
export const TIP_MAX_SHOWS = 2;

export type TipId =
  | 'shopCoins'
  | 'afterLosses'
  | 'firstBoss'
  | 'onlineFriends'
  | 'dailyMissions'
  | 'ghostShip';

export interface TipsState {
  shown: Partial<Record<TipId, number>>;
  dismissed: Partial<Record<TipId, boolean>>;
  lastMapTip: TipId | null;
  mapVisits: number;
  onboardDone: boolean;
  lossesByLevel: Record<string, number>;
  lastLossLevel: number | null;
  coinsSeen: boolean;
  visitHadTip: boolean;
}

export interface TipContext {
  coins: number;
  canAffordShip: boolean;
  unlocked: number;
  lastLossLevel: number | null;
  lossesOnLevel: number;
  missionsReady: boolean;
  ghostOn: boolean;
  finishedCount: number;
  justReturnedFromPlay?: boolean;
}

const EMPTY: TipsState = {
  shown: {},
  dismissed: {},
  lastMapTip: null,
  mapVisits: 0,
  onboardDone: false,
  lossesByLevel: {},
  lastLossLevel: null,
  coinsSeen: false,
  visitHadTip: false,
};

export function loadTips(): TipsState {
  try {
    const raw = localStorage.getItem(TIPS_KEY);
    if (!raw) return { ...EMPTY, shown: {}, dismissed: {}, lossesByLevel: {} };
    const parsed = JSON.parse(raw) as TipsState;
    return {
      ...EMPTY,
      ...parsed,
      shown: parsed.shown || {},
      dismissed: parsed.dismissed || {},
      lossesByLevel: parsed.lossesByLevel || {},
    };
  } catch {
    return { ...EMPTY, shown: {}, dismissed: {}, lossesByLevel: {} };
  }
}

export function saveTips(state: TipsState): void {
  try {
    localStorage.setItem(TIPS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function canShowTip(state: TipsState, id: TipId): boolean {
  if (state.visitHadTip) return false;
  if (state.dismissed[id]) return false;
  return (state.shown[id] || 0) < TIP_MAX_SHOWS;
}

export function markTipShown(state: TipsState, id: TipId): TipsState {
  const next: TipsState = {
    ...state,
    shown: { ...state.shown, [id]: (state.shown[id] || 0) + 1 },
    lastMapTip: id,
    visitHadTip: true,
  };
  saveTips(next);
  return next;
}

export function dismissTip(state: TipsState, id: TipId): TipsState {
  const next: TipsState = {
    ...state,
    dismissed: { ...state.dismissed, [id]: true },
    shown: { ...state.shown, [id]: TIP_MAX_SHOWS },
    visitHadTip: true,
    lastMapTip: id,
  };
  saveTips(next);
  return next;
}

export function beginMapVisit(state: TipsState): TipsState {
  const next = { ...state, mapVisits: state.mapVisits + 1, visitHadTip: false };
  saveTips(next);
  return next;
}

export function recordLevelLoss(state: TipsState, level: number): TipsState {
  const key = String(level);
  const next: TipsState = {
    ...state,
    lastLossLevel: level,
    lossesByLevel: { ...state.lossesByLevel, [key]: (state.lossesByLevel[key] || 0) + 1 },
  };
  saveTips(next);
  return next;
}

export function pickMapTip(state: TipsState, ctx: TipContext): TipId | null {
  if (state.visitHadTip) return null;

  if (ctx.coins > 0 && ctx.canAffordShip && canShowTip(state, 'shopCoins')) {
    return 'shopCoins';
  }
  if (ctx.lossesOnLevel >= 2 && canShowTip(state, 'afterLosses')) {
    return 'afterLosses';
  }
  if (ctx.unlocked >= 3 && ctx.unlocked <= 4 && canShowTip(state, 'firstBoss')) {
    return 'firstBoss';
  }
  if (ctx.missionsReady && canShowTip(state, 'dailyMissions')) {
    return 'dailyMissions';
  }
  if (ctx.ghostOn && ctx.finishedCount >= 1 && canShowTip(state, 'ghostShip')) {
    return 'ghostShip';
  }
  if (ctx.unlocked >= 3 && canShowTip(state, 'onlineFriends')) {
    const later = ctx.unlocked >= 8 && (state.mapVisits % 4 === 0);
    if (ctx.unlocked === 3 || ctx.unlocked === 4 || later) return 'onlineFriends';
  }
  return null;
}

export function cheapestAffordableShip(
  coins: number,
  owned: string[],
  catalog: Array<{ id: string; price: number }>,
): { id: string; price: number } | null {
  const buyable = catalog
    .filter((s) => s.price > 0 && !owned.includes(s.id) && coins >= s.price)
    .sort((a, b) => a.price - b.price);
  return buyable[0] || null;
}
