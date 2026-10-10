export const ONBOARD_KEY = 'spaceMissionOnboardV1';
export const TRAINING_COINS = 60;
export const TRAINING_LEVEL = 0;

export const TRAIN_STEPS = [
  'moveLeft',
  'moveRight',
  'shootRock',
  'collectCoin',
  'grabPower',
  'avoidHazard',
  'miniBoss',
] as const;

/** First-session map coach only. Later features use PROGRESSIVE_TIPS. */
export const MAP_TOUR_STEPS = [
  'planets',
] as const;

export const JIT_IDS = [
  'blackHole',
  'wormhole',
  'boss',
  'hazard',
  'affordShip',
  'firstLoss',
  'onlineUnlock',
] as const;

export type TrainStep = (typeof TRAIN_STEPS)[number];
export type MapTourStep = (typeof MAP_TOUR_STEPS)[number];
export type JitId = (typeof JIT_IDS)[number];
export type OnboardPhase = 'welcome' | 'training' | 'mapTour' | 'done';

export interface OnboardState {
  welcomeDone: boolean;
  trainingDone: boolean;
  mapTourDone: boolean;
  skipped: boolean;
  skipAllTips: boolean;
  revealed: Partial<Record<string, boolean>>;
  jitShown: Partial<Record<JitId, boolean>>;
}

export interface ProgressiveTip {
  id: string;
  /** Minimum completed levels (stars > 0). */
  afterWins: number;
  minUnlocked?: number;
  when: 'firstMap' | 'afterLevel' | 'sessionStart';
  needsAfford?: boolean;
}

export const PROGRESSIVE_TIPS: ProgressiveTip[] = [
  { id: 'planets', when: 'firstMap', afterWins: 0 },
  { id: 'shop', when: 'afterLevel', afterWins: 1, needsAfford: true },
  { id: 'missions', when: 'afterLevel', afterWins: 1, minUnlocked: 2 },
  { id: 'twoPlayer', when: 'afterLevel', afterWins: 2, minUnlocked: 3 },
  { id: 'weekly', when: 'afterLevel', afterWins: 3, minUnlocked: 4 },
  { id: 'difficulty', when: 'afterLevel', afterWins: 4, minUnlocked: 5 },
  { id: 'account', when: 'afterLevel', afterWins: 5, minUnlocked: 6 },
];

export interface ProgressiveTipContext {
  unlocked: number;
  finishedCount: number;
  canAffordShip: boolean;
  coins: number;
  signedIn?: boolean;
  firstMap?: boolean;
  justReturnedFromPlay?: boolean;
  sessionStart?: boolean;
}

const EMPTY: OnboardState = {
  welcomeDone: false,
  trainingDone: false,
  mapTourDone: false,
  skipped: false,
  skipAllTips: false,
  revealed: {},
  jitShown: {},
};

export function emptyOnboard(): OnboardState {
  return { ...EMPTY, revealed: {}, jitShown: {} };
}

export function loadOnboard(): OnboardState {
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (!raw) return emptyOnboard();
    const parsed = JSON.parse(raw) as OnboardState;
    return {
      ...EMPTY,
      ...parsed,
      revealed: parsed.revealed || {},
      jitShown: parsed.jitShown || {},
    };
  } catch {
    return emptyOnboard();
  }
}

export function saveOnboard(state: OnboardState): OnboardState {
  try {
    localStorage.setItem(ONBOARD_KEY, JSON.stringify(state));
  } catch {
    // ignore quota
  }
  return state;
}

export function phaseOf(state: OnboardState): OnboardPhase {
  if (!state.welcomeDone) return 'welcome';
  if (!state.trainingDone) return 'training';
  if (!state.mapTourDone) return 'mapTour';
  return 'done';
}

export function markWelcome(state: OnboardState): OnboardState {
  return saveOnboard({ ...state, welcomeDone: true });
}

export function markTraining(state: OnboardState, skipped = false): OnboardState {
  return saveOnboard({ ...state, welcomeDone: true, trainingDone: true, skipped: state.skipped || skipped });
}

export function markMapTour(state: OnboardState, skipped = false): OnboardState {
  return saveOnboard({
    ...state,
    welcomeDone: true,
    trainingDone: true,
    mapTourDone: true,
    skipped: state.skipped || skipped,
    skipAllTips: state.skipAllTips || skipped,
    revealed: { ...state.revealed, planets: true },
  });
}

export function markAllDone(state: OnboardState, skipped = true): OnboardState {
  return saveOnboard({
    ...state,
    welcomeDone: true,
    trainingDone: true,
    mapTourDone: true,
    skipped,
    skipAllTips: skipped,
  });
}

export function markSkipAllTips(state: OnboardState): OnboardState {
  return saveOnboard({ ...state, skipAllTips: true, mapTourDone: true });
}

export function markRevealed(state: OnboardState, id: string): OnboardState {
  if (state.revealed[id]) return state;
  return saveOnboard({ ...state, revealed: { ...state.revealed, [id]: true } });
}

export function markJit(state: OnboardState, id: JitId): OnboardState {
  if (state.jitShown[id]) return state;
  return saveOnboard({ ...state, jitShown: { ...state.jitShown, [id]: true } });
}

export function canShowJit(state: OnboardState, id: JitId): boolean {
  if (state.skipAllTips) return false;
  return !state.jitShown[id];
}

export function resetTutorial(state: OnboardState): OnboardState {
  return saveOnboard({
    ...state,
    trainingDone: false,
    mapTourDone: false,
    skipped: false,
    skipAllTips: false,
    revealed: {},
  });
}

export function nextTrainStep(step: TrainStep | null): TrainStep | null {
  if (!step) return TRAIN_STEPS[0];
  const i = TRAIN_STEPS.indexOf(step);
  return i >= 0 && i < TRAIN_STEPS.length - 1 ? TRAIN_STEPS[i + 1] : null;
}

export function nextMapStep(step: MapTourStep | null): MapTourStep | null {
  if (!step) return MAP_TOUR_STEPS[0];
  const i = MAP_TOUR_STEPS.indexOf(step);
  return i >= 0 && i < MAP_TOUR_STEPS.length - 1 ? MAP_TOUR_STEPS[i + 1] : null;
}

export function trainPromptKey(step: TrainStep): string {
  return `tips.train_${step}`;
}

export function mapTourPromptKey(step: MapTourStep): string {
  return `tips.tour_${step}`;
}

export function jitPromptKey(id: JitId): string {
  return `tips.jit_${id}`;
}

export function pickProgressiveTip(
  state: OnboardState,
  ctx: ProgressiveTipContext,
): string | null {
  if (state.skipAllTips) return null;
  for (const tip of PROGRESSIVE_TIPS) {
    if (state.revealed[tip.id]) continue;
    if (tip.minUnlocked && ctx.unlocked < tip.minUnlocked) continue;
    if (ctx.finishedCount < tip.afterWins) continue;
    if (tip.needsAfford && !ctx.canAffordShip && ctx.coins < 60) continue;
    if (tip.id === 'account' && ctx.signedIn) continue;
    if (tip.when === 'firstMap' && !ctx.firstMap) continue;
    if (tip.when === 'afterLevel' && !ctx.justReturnedFromPlay && !ctx.sessionStart) continue;
    if (tip.when === 'sessionStart' && !ctx.sessionStart) continue;
    if (tip.when === 'afterLevel' && ctx.sessionStart && !ctx.justReturnedFromPlay && tip.id !== 'shop') {
      // Session start may reveal at most one leftover tip.
    }
    return tip.id;
  }
  return null;
}
