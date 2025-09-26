const SESSION_ID_KEY = 'guest_session_id';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ensureGuestSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return null;
  }
}

function storageKey(sessionId) {
  return sessionId ? `guest_orders:${sessionId}` : 'guest_orders:fallback';
}

function resolveSessionId(sessionId) {
  if (sessionId) return sessionId;
  const ensured = ensureGuestSessionId();
  return ensured || null;
}

function migrateFallbackToSession(targetKey) {
  if (typeof window === 'undefined') return;
  try {
    const fallbackKey = storageKey(null);
    if (targetKey === fallbackKey) return;
    const fallbackRaw = sessionStorage.getItem(fallbackKey);
    if (!fallbackRaw) return;
    sessionStorage.setItem(targetKey, fallbackRaw);
    sessionStorage.removeItem(fallbackKey);
  } catch {
    // swallow
  }
}

export function readGuestOrders(sessionId) {
  if (typeof window === 'undefined') return [];
  try {
    const resolvedId = resolveSessionId(sessionId);
    const key = storageKey(resolvedId);
    migrateFallbackToSession(key);
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestOrders(orders, sessionId) {
  if (typeof window === 'undefined') return;
  try {
    const resolvedId = resolveSessionId(sessionId);
    const key = storageKey(resolvedId);
    sessionStorage.setItem(key, JSON.stringify(Array.isArray(orders) ? orders : []));
  } catch {
    // ignore
  }
}

export function appendGuestOrder(order, sessionId = ensureGuestSessionId(), limit = 50) {
  const resolvedId = resolveSessionId(sessionId);
  const existing = readGuestOrders(resolvedId);
  const orderWithSession = {
    ...(order || {}),
    sessionId: (order && order.sessionId) || resolvedId || null
  };
  const next = [orderWithSession, ...existing].slice(0, limit);
  writeGuestOrders(next, resolvedId);
  return next;
}
