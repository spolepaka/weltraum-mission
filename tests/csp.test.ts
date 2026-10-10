import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const VERCEL = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: Array<{ headers: Array<{ key: string; value: string }> }>;
};

function metaCsp(html: string): string {
  const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!m) throw new Error('HTML meta CSP missing');
  return m[1];
}

function headerCsp(): string {
  const csp = VERCEL.headers[0].headers.find((h) => h.key === 'Content-Security-Policy');
  if (!csp) throw new Error('vercel.json CSP missing');
  return csp.value;
}

function directive(csp: string, name: string): string {
  const part = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + ' '));
  if (!part) throw new Error(`CSP missing ${name}`);
  return part;
}

describe('production Firebase Auth CSP', () => {
  it('HTML meta script-src allows gapi + gstatic (popup helper)', () => {
    const script = directive(metaCsp(HTML), 'script-src');
    expect(script).toContain('https://apis.google.com');
    expect(script).toContain('https://www.gstatic.com');
  });

  it('HTML meta connect-src allows Identity Toolkit, Secure Token, googleapis, apis', () => {
    const connect = directive(metaCsp(HTML), 'connect-src');
    expect(connect).toContain('https://identitytoolkit.googleapis.com');
    expect(connect).toContain('https://securetoken.googleapis.com');
    expect(connect).toContain('https://www.googleapis.com');
    expect(connect).toContain('https://apis.google.com');
    expect(connect).not.toContain('http://localhost');
  });

  it('HTML meta frame-src allows Google accounts and firebaseapp auth handler', () => {
    const frame = directive(metaCsp(HTML), 'frame-src');
    expect(frame).toContain('https://accounts.google.com');
    expect(frame).toContain('https://*.firebaseapp.com');
  });

  it('vercel.json header CSP matches the same Firebase hosts', () => {
    const csp = headerCsp();
    const script = directive(csp, 'script-src');
    const connect = directive(csp, 'connect-src');
    expect(script).toContain('https://apis.google.com');
    expect(script).toContain('https://www.gstatic.com');
    expect(connect).toContain('https://www.googleapis.com');
    expect(directive(csp, 'frame-src')).toContain('https://accounts.google.com');
  });
});
