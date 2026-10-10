export const DNT_KEY = 'spaceMissionDoNotTrack';

export type AnalyticsKind =
  | 'session_start'
  | 'level_start'
  | 'level_win'
  | 'level_loss'
  | 'level_quit'
  | 'shop_open'
  | 'shop_purchase'
  | 'tip_shown'
  | 'tip_clicked'
  | 'room_created'
  | 'room_joined'
  | 'sign_in';

export const FUNNEL_STEPS = ['session_start', 'level3_win', 'shop_open', 'shop_purchase', 'multiplayer'] as const;

export function loadDoNotTrack(): boolean {
  try {
    return localStorage.getItem(DNT_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveDoNotTrack(on: boolean): void {
  try {
    localStorage.setItem(DNT_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

export function funnelKey(kind: AnalyticsKind, level?: number): string | null {
  if (kind === 'session_start') return 'session_start';
  if (kind === 'level_win' && level === 3) return 'level3_win';
  if (kind === 'shop_open') return 'shop_open';
  if (kind === 'shop_purchase') return 'shop_purchase';
  if (kind === 'room_created' || kind === 'room_joined') return 'multiplayer';
  return null;
}
