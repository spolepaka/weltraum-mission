import { describe, expect, it } from 'vitest';
import {
  canShowJit,
  emptyOnboard,
  markAllDone,
  markJit,
  markMapTour,
  markTraining,
  markWelcome,
  nextMapStep,
  nextTrainStep,
  phaseOf,
  resetTutorial,
  TRAIN_STEPS,
  MAP_TOUR_STEPS,
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
