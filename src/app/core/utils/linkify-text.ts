/**
 * Split plain text into segments so URLs can be rendered as safe <a> elements
 * (only http(s); www. is normalized to https://).
 */

export type LinkifySegment =
  | { kind: 'text'; value: string }
  | { kind: 'url'; value: string; href: string };

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/** Trim benign trailing punctuation often glued to URLs in chat. */
function cleanUrlToken(raw: string): string {
  return raw.replace(/[.,;:]+$/u, '').trim();
}

export function safeHttpHref(raw: string): string | null {
  let s = cleanUrlToken(raw);
  if (!s) return null;
  if (/^www\./i.test(s)) {
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

export function linkifyToSegments(input: string): LinkifySegment[] {
  if (input == null || input.length === 0) {
    return [];
  }
  const segments: LinkifySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      segments.push({ kind: 'text', value: input.slice(last, m.index) });
    }
    const token = m[0];
    const href = safeHttpHref(token);
    if (href) {
      const display = cleanUrlToken(token);
      segments.push({ kind: 'url', value: display, href });
    } else {
      segments.push({ kind: 'text', value: token });
    }
    last = m.index + token.length;
  }
  if (last < input.length) {
    segments.push({ kind: 'text', value: input.slice(last) });
  }
  return segments;
}
