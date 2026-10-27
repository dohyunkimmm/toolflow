'use strict';

// Retry-After may be a delay in seconds or an RFC 7231 HTTP-date.
// Do not copy provider-controlled strings directly to the client header.
function safeProviderRetryAfter(value, nowMs = Date.now()) {
  const raw = typeof value === 'string' ? value.trim() : '';
  let seconds = NaN;
  if (/^\\d+(?:\\.\\d+)?$/.test(raw)) {
    seconds = Number(raw);
  } else if (/^[A-Z][a-z]{2}, \\d{2} [A-Z][a-z]{2} \\d{4} \\d{2}:\\d{2}:\\d{2} GMT$/.test(raw)) {
    const targetMs = Date.parse(raw);
    if (Number.isFinite(targetMs) && Number.isFinite(nowMs)) {
      seconds = (targetMs - nowMs) / 1000;
    }
  }
  if (!Number.isFinite(seconds) || seconds < 1) return 60;
  return Math.min(3600, Math.ceil(seconds));
}
module.exports = { safeProviderRetryAfter };
