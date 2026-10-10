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

export const MAP_TOUR_STEPS = [
  'planets',
  'stars',
  'shop',
  'missions',
  'twoPlayer',
  'online',
  'account',
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
  jitShown: Partial<Record<JitId, boolean>>;
}

const EMPTY: OnboardState = {
  welcomeDone: false,
  trainingDone: false,
  mapTourDone: false,
  skipped: false,
  jitShown: {},
};

export function emptyOnboard(): OnboardState {
  return { ...EMPTY, jitShown: {} };
}

export function loadOnboard(): OnboardState {
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (!raw) return emptyOnboard();
    const parsed = JSON.parse(raw) as OnboardState;
    return {
      ...EMPTY,
      ...parsed,
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
  });
}

export function markAllDone(state: OnboardState, skipped = true): OnboardState {
  return saveOnboard({
    ...state,
    welcomeDone: true,
    trainingDone: true,
    mapTourDone: true,
    skipped,
  });
}

export function markJit(state: OnboardState, id: JitId): OnboardState {
  if (state.jitShown[id]) return state;
  return saveOnboard({ ...state, jitShown: { ...state.jitShown, [id]: true } });
}

export function canShowJit(state: OnboardState, id: JitId): boolean {
  return !state.jitShown[id];
}

export function resetTutorial(state: OnboardState): OnboardState {
  return saveOnboard({
    ...state,
    trainingDone: false,
    mapTourDone: false,
    skipped: false,
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
