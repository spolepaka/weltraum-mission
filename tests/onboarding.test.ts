import { describe, expect, it } from 'vitest';
import {
  canShowJit,
  emptyOnboard,
  markAllDone,
  markJit,
  markMapTour,
  markRevealed,
  markTraining,
  markWelcome,
  nextMapStep,
  nextTrainStep,
  phaseOf,
  pickProgressiveTip,
  resetTutorial,
  TRAIN_STEPS,
  MAP_TOUR_STEPS,
  PROGRESSIVE_TIPS,
} from '../src/lib/onboarding';

describe('onboarding state machine', () => {
  it('starts at welcome and advances through training then map tour', () => {
    let st = emptyOnboard();
    expect(phaseOf(st)).toBe('welcome');
    st = markWelcome(st);
    expect(phaseOf(st)).toBe('training');
    st = markTraining(st);
    expect(phaseOf(st)).toBe('mapTour');
    st = markMapTour(st);
    expect(phaseOf(st)).toBe('done');
  });

  it('walks every training and map-tour step in order', () => {
    let step = nextTrainStep(null);
    const seen: string[] = [];
    while (step) {
      seen.push(step);
      step = nextTrainStep(step);
    }
    expect(seen).toEqual([...TRAIN_STEPS]);
    let tour = nextMapStep(null);
    const tours: string[] = [];
    while (tour) {
      tours.push(tour);
      tour = nextMapStep(tour);
    }
    expect(tours).toEqual([...MAP_TOUR_STEPS]);
    expect(MAP_TOUR_STEPS).toEqual(['planets']);
  });

  it('reveals later tips one at a time after wins', () => {
    let st = markMapTour(markTraining(markWelcome(emptyOnboard())));
    expect(pickProgressiveTip(st, {
      unlocked: 2, finishedCount: 1, canAffordShip: true, coins: 80, justReturnedFromPlay: true,
    })).toBe('shop');
    st = markRevealed(st, 'shop');
    expect(pickProgressiveTip(st, {
      unlocked: 2, finishedCount: 1, canAffordShip: true, coins: 80, justReturnedFromPlay: true,
    })).toBe('missions');
    const second = pickProgressiveTip(st, {
      unlocked: 2, finishedCount: 1, canAffordShip: true, coins: 80, justReturnedFromPlay: true,
    });
    expect(second).toBe('missions');
    expect(PROGRESSIVE_TIPS.length).toBeGreaterThan(4);
  });

  it('shows each just-in-time tip only once', () => {
    let st = emptyOnboard();
    expect(canShowJit(st, 'boss')).toBe(true);
    st = markJit(st, 'boss');
    expect(canShowJit(st, 'boss')).toBe(false);
    expect(canShowJit(st, 'blackHole')).toBe(true);
  });

  it('replay resets training and map tour but keeps welcome', () => {
    let st = markAllDone(emptyOnboard(), false);
    expect(phaseOf(st)).toBe('done');
    st = resetTutorial(st);
    expect(st.welcomeDone).toBe(true);
    expect(phaseOf(st)).toBe('training');
  });
});
