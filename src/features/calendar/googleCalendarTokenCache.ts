type CachedToken = { accessToken: string; expiresAt: number };

const tokens = new Map<string, CachedToken>();
const MAX_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const STORAGE_PREFIX = 'meetagain:google-calendar-token:';

// sessionStorage survives a page reload but is cleared when the tab session ends.
// Native runtimes keep the in-memory cache only; no unencrypted persistent storage is used.
function sessionStore(): Storage | null {
  try {
    return typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(uid)}`;
}

export function rememberGoogleCalendarToken(uid: string, accessToken: string, expiresInSeconds?: number, now = Date.now()) {
  if (!uid || !accessToken) return;
  const requestedLifetime = Number.isFinite(expiresInSeconds) && (expiresInSeconds as number) > 0
    ? (expiresInSeconds as number) * 1000
    : DEFAULT_TOKEN_LIFETIME_MS;
  const cached = { accessToken, expiresAt: now + Math.min(requestedLifetime, MAX_TOKEN_LIFETIME_MS) };
  tokens.set(uid, cached);
  try { sessionStore()?.setItem(storageKey(uid), JSON.stringify(cached)); } catch { /* Storage may be unavailable or full. */ }
}

export function getGoogleCalendarToken(uid: string, now = Date.now()): string | null {
  let cached = tokens.get(uid);
  if (!cached) {
    try {
      const raw = sessionStore()?.getItem(storageKey(uid));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'accessToken' in parsed && 'expiresAt' in parsed
          && typeof parsed.accessToken === 'string' && parsed.accessToken
          && typeof parsed.expiresAt === 'number' && Number.isFinite(parsed.expiresAt)) {
          cached = { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
          tokens.set(uid, cached);
        } else {
          sessionStore()?.removeItem(storageKey(uid));
        }
      }
    } catch {
      try { sessionStore()?.removeItem(storageKey(uid)); } catch { /* Ignore unavailable storage. */ }
    }
  }
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    tokens.delete(uid);
    try { sessionStore()?.removeItem(storageKey(uid)); } catch { /* Ignore unavailable storage. */ }
    return null;
  }
  return cached.accessToken;
}

export function clearGoogleCalendarToken(uid: string) {
  tokens.delete(uid);
  try { sessionStore()?.removeItem(storageKey(uid)); } catch { /* Ignore unavailable storage. */ }
}

export function clearAllGoogleCalendarTokens() {
  tokens.clear();
  try {
    const storage = sessionStore();
    if (storage) for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
    }
  } catch { /* Ignore unavailable storage. */ }
}
