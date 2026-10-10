/**
 * Catalog + marker isolation. Adding a language: copy en.ts → xx.ts,
 * register it in src/i18n/index.ts, and add xx-only markers here.
 */
import { describe, it, expect } from 'vitest';
import { de } from '../src/i18n/de';
import { en } from '../src/i18n/en';
import {
  catalogStrings,
  DE_ONLY_MARKERS,
  EN_ONLY_MARKERS,
  markersForOtherLanguage,
} from '../src/i18n/markers';
import { flattenStrings, getLanguage, initLanguage, registerLanguage, setLanguage, t } from '../src/i18n';
import { SUPPORTED_LANGUAGES } from '../src/i18n/types';

function blob(strings: string[]): string {
  return strings.join('\n');
}

describe('i18n structure', () => {
  it('defaults to English and can register more languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('de');
    expect(getLanguage()).toBe('en');
    registerLanguage('en', en);
    expect(t('title')).toBe('Space Mission');
    expect(t('bossDefeated')).toBe('BOSS DEFEATED!');
  });

  it('English catalog contains no distinctive German markers', () => {
    const text = blob(flattenStrings(en));
    for (const marker of DE_ONLY_MARKERS) {
      expect(text, `EN catalog leaked DE marker: ${marker}`).not.toContain(marker);
    }
  });

  it('German catalog contains no distinctive English markers', () => {
    const text = blob(flattenStrings(de));
    for (const marker of EN_ONLY_MARKERS) {
      expect(text, `DE catalog leaked EN marker: ${marker}`).not.toContain(marker);
    }
  });

  it('switching language changes catalog lookups', () => {
    setLanguage('de');
    expect(t('bossDefeated')).toBe('BOSS BESIEGT!');
    expect(t('account.guest')).toBe('Anonymer Gast');
    setLanguage('en');
    expect(t('bossDefeated')).toBe('BOSS DEFEATED!');
    expect(t('account.guest')).toBe('Anonymous guest');
  });

  it('markersForOtherLanguage returns the opposite set', () => {
    expect(markersForOtherLanguage('en')).toBe(DE_ONLY_MARKERS);
    expect(markersForOtherLanguage('de')).toBe(EN_ONLY_MARKERS);
    expect(catalogStrings('en').length).toBeGreaterThan(80);
    expect(catalogStrings('de').length).toBeGreaterThan(80);
  });

  it('initLanguage ignores browser locale and stays English without a stored choice', () => {
    const store: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    };
    (globalThis as { localStorage?: typeof ls }).localStorage = ls;
    expect(initLanguage()).toBe('en');
  });
});
