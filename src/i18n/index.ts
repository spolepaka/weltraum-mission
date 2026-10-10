import { en } from './en';
import { de } from './de';
import {
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type Language,
  type Translations,
} from './types';

export type { Language, Translations };
export { LANGUAGE_META, SUPPORTED_LANGUAGES };

const catalogs: Record<Language, Translations> = { en, de };

export function registerLanguage(lang: Language, catalog: Translations): void {
  catalogs[lang] = catalog;
}

export function getCatalog(lang: Language = getLanguage()): Translations {
  return catalogs[lang] || catalogs.en;
}

export function getAllCatalogs(): Record<Language, Translations> {
  return catalogs;
}

let currentLanguage: Language = 'en';
let listeners: Array<(lang: Language) => void> = [];

const STORAGE_KEY = 'spaceMissionLanguage';

export function initLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      currentLanguage = stored as Language;
    } else {
      currentLanguage = 'en';
    }
  } catch {
    currentLanguage = 'en';
  }
  return currentLanguage;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) return;
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  listeners.forEach(fn => fn(lang));
}

export function toggleLanguage(): Language {
  const idx = SUPPORTED_LANGUAGES.indexOf(currentLanguage);
  const next = SUPPORTED_LANGUAGES[(idx + 1) % SUPPORTED_LANGUAGES.length];
  setLanguage(next);
  return next;
}

export function onLanguageChange(callback: (lang: Language) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(fn => fn !== callback);
  };
}

function lookup(source: unknown, keys: string[]): unknown {
  let value: unknown = source;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as object)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return value;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value = lookup(catalogs[currentLanguage], keys);
  if (typeof value !== 'string') {
    value = lookup(catalogs.en, keys);
  }
  if (typeof value !== 'string') return key;

  let result = value;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }
  return result;
}

export function flattenStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === 'string') {
    out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => flattenStrings(item, out));
    return out;
  }
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(v => flattenStrings(v, out));
  }
  return out;
}

if (typeof window !== 'undefined') {
  const w = window as Window & {
    __I18N_BUNDLE__?: { en: Translations; de: Translations };
    __I18N_API__?: {
      t: typeof t;
      getLanguage: typeof getLanguage;
      setLanguage: typeof setLanguage;
      toggleLanguage: typeof toggleLanguage;
      onLanguageChange: typeof onLanguageChange;
      initLanguage: typeof initLanguage;
      getCatalog: typeof getCatalog;
    };
  };
  w.__I18N_BUNDLE__ = { en, de };
  w.__I18N_API__ = { t, getLanguage, setLanguage, toggleLanguage, onLanguageChange, initLanguage, getCatalog };
}

export { en, de };
