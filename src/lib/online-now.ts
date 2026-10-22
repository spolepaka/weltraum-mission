export type OnlineActivity = 'menu' | 'solo' | 'coop' | 'versus';

export function formatOnlineBadge(n: number, template: string): string {
  return `🟢 ${template.replace(/\{n\}/g, String(Math.max(0, Math.floor(n))))}`;
}

export function shouldShowOnlineBadge(isAdmin: boolean): boolean {
  return isAdmin === true;
}

export function inferOnlineActivity(input: {
  versus?: boolean;
  netRole?: string | null;
  playing?: boolean;
}): OnlineActivity {
  if (input.versus) return 'versus';
  if (input.netRole) return 'coop';
  if (input.playing) return 'solo';
  return 'menu';
}
