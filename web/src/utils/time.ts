// Human-friendly relative times ("2m ago") with graceful fallback.
export function timeAgo(input: string | null | undefined): string {
  if (!input) return '—';
  const s = String(input).trim();
  if (!s || /just now/i.test(s)) return 'just now';
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return s;
  const diff = Date.now() - t;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

// Raw health-check failures translated into plain words.
export function friendlyCause(cause: string | null | undefined): string {
  const c = String(cause || '');
  if (/ECONNRESET/i.test(c)) return 'Site dropped the connection mid-check';
  if (/ECONNREFUSED/i.test(c)) return 'Site refused the connection — nothing listening there';
  if (/ETIMEDOUT|timeout/i.test(c)) return 'Site took too long to answer';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(c)) return 'Site address could not be resolved';
  if (/502/.test(c)) return 'Site returned an error (bad gateway)';
  if (/503/.test(c)) return 'Site is temporarily unavailable';
  if (/3 failed checks/i.test(c)) return 'Health check failed 3 times in a row';
  return c || 'Health check failing';
}
