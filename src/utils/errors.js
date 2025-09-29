export function formatApiError(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  const messages = [];
  const payload = error.payload ?? error.data ?? error.response?.data ?? null;
  const status = error.status ?? error.response?.status ?? null;

  const primaryCandidates = [
    error.message,
    typeof payload === 'string' ? payload : null,
    payload?.message,
    payload?.error,
    payload?.detail,
    payload?.title
  ];

  const primary = primaryCandidates.find(msg => typeof msg === 'string' && msg.trim().length > 0);
  if (primary) {
    messages.push(primary.trim());
  }

  const validation = payload?.errors;
  if (validation && typeof validation === 'object') {
    const fieldErrors = Object.entries(validation)
      .flatMap(([, value]) => Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .map(String)
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0);
    if (fieldErrors.length > 0) {
      messages.push(fieldErrors.join(' '));
    }
  }

  if (messages.length === 0) {
    if (status && typeof status === 'number') {
      messages.push(`Request failed with status ${status}.`);
    }
  }

  if (messages.length === 0) {
    return fallback;
  }

  return messages.join(' ').trim();
}

export function captureApiError(error) {
  const payload = error?.payload ?? error?.data ?? error?.response?.data ?? null;
  if (process.env.NODE_ENV !== 'production') {
    console.error('API error details:', {
      message: error?.message,
      status: error?.status ?? error?.response?.status,
      payload
    });
  }
}
