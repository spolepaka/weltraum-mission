import { de } from './de';
import { en } from './en';
import { flattenStrings } from './index';
import type { Language } from './types';

/** Distinctive tokens that must never appear when the other language is active. */
export const EN_ONLY_MARKERS = [
  'Tap on a planet',
  'Level Complete',
  'Game Over',
  'Back to Map',
  'Spaceship Hangar',
  'Not enough coins',
  'Home Galaxy',
  'Daily Missions',
  'Progress saved',
  'Join requests',
  'BOSS DEFEATED',
  'BOSS ALERT',
  'How to play',
  'Your Records',
  'Anonymous guest',
  'Parent: save progress',
  'Own name',
  'Type your name',
  'Try {name} instead.',
  'Sign in with Google',
  'Email link (passwordless)',
  'Collect the remaining coins',
  'Mission ended',
  'Swallowed by a black hole',
  'Shield incoming',
  'slow fire',
  'SECTOR BOSS',
  'Claim your reward',
  'Create Room',
  'Play Again',
  'Total Score',
  'Steer against it',
  'hits in a row',
  'Ouch!',
  'Too close to the mine',
  'Visit the Shop',
  'Got it',
  'Ask before letting people in',
  'Weekly challenge',
  'Do not track play stats',
  "Let's fly!",
  'Welcome, pilot!',
  'Replay tutorial',
  'Training flight',
  'Skip training',
  'Updating the game…',
] as const;

export const DE_ONLY_MARKERS = [
  'Tippe auf einen Planeten',
  'Level geschafft',
  'Verloren',
  'Zur Karte',
  'Raumschiff-Hangar',
  'Nicht genug Münzen',
  'Heimat-Galaxie',
  'Tages-Missionen',
  'Fortschritt gespeichert',
  'Beitrittsanfragen',
  'BOSS BESIEGT',
  'BOSS-ALARM',
  'So geht',
  'Deine Rekorde',
  'Anonymer Gast',
  'Eltern: Fortschritt sichern',
  'Eigener Name',
  'Tippe deinen Namen',
  'Versuch’s mit',
  'Mit Google anmelden',
  'E-Mail-Link (ohne Passwort)',
  'Sammle die restlichen Münzen',
  'Mission beendet',
  'Vom Schwarzen Loch',
  'Schild kommt',
  'langsames Feuer',
  'SEKTOR-BOSS',
  'Belohnung auf der Karte',
  'Raum erstellen',
  'Gesamtpunkte',
  'Gegensteuern',
  'Treffer hintereinander',
  'Autsch!',
  'Zu nah an der Mine',
  'Schau im Shop',
  'Verstanden',
  'Erst fragen, bevor jemand reinkommt',
  'Wochen-Challenge',
  'Spielstatistik nicht erfassen',
  'Losfliegen!',
  'Willkommen, Pilot!',
  'Tutorial nochmal',
  'Trainingsflug',
  'Training überspringen',
  'Spiel wird aktualisiert…',
] as const;

export function markersForOtherLanguage(lang: Language): readonly string[] {
  return lang === 'en' ? DE_ONLY_MARKERS : EN_ONLY_MARKERS;
}

export function catalogStrings(lang: Language): string[] {
  return flattenStrings(lang === 'en' ? en : de);
}

const SHARED_OK = [
  'OK', 'MAX', 'Level', 'Shop', 'Online', 'Pause', 'BOSS', 'FINALE', 'P1', 'P2',
  'Laser', 'Magnet', 'Omega', 'Nova', 'Amelia', 'Gravitron',
];

export function isSharedToken(text: string): boolean {
  return SHARED_OK.some(tok => text === tok || text.includes(tok));
}
