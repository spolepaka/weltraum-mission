import { en, type Translations } from './en';
import { de } from './de';

export type Language = 'en' | 'de';

const translations: Record<Language, Translations> = { en, de };

let currentLanguage: Language = 'en';
let listeners: Array<(lang: Language) => void> = [];

const STORAGE_KEY = 'spaceMissionLanguage';

export function initLanguage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'de') {
      currentLanguage = stored;
    } else {
      const browserLang = navigator.language.toLowerCase();
      currentLanguage = browserLang.startsWith('de') ? 'de' : 'en';
    }
  } catch {
    currentLanguage = 'en';
  }
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(lang: Language): void {
  if (lang !== currentLanguage) {
    currentLanguage = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    listeners.forEach(fn => fn(lang));
  }
}

export function toggleLanguage(): Language {
  const newLang = currentLanguage === 'en' ? 'de' : 'en';
  setLanguage(newLang);
  return newLang;
}

export function onLanguageChange(callback: (lang: Language) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(fn => fn !== callback);
  };
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = (value as Record<string, unknown>)[k2];
        } else {
          return key;
        }
      }
      break;
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  let result = value;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(`{${paramKey}}`, String(paramValue));
    }
  }
  
  return result;
}

export { type Translations };
