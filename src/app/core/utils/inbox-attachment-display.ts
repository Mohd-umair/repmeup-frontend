/**
 * Labels and download helpers for file/PDF attachments in inbox threads.
 */

const ATTACHMENT_FILENAME_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|zip|txt|rtf)$/i;

/** Meta WhatsApp Cloud API could not deliver message content (type: unsupported). */
export function isUnsupportedWhatsAppIncoming(msg: {
  type?: string;
  text?: string;
  content?: string;
  isUnsupported?: boolean;
}): boolean {
  if (msg.isUnsupported || msg.type === 'unsupported') return true;
  const t = String(msg.text ?? msg.content ?? '').trim();
  return /^\[Unsupported message type:\s*[\w.-]+\]$/i.test(t);
}

/** User-facing copy for unsupported / legacy placeholder inbound WhatsApp messages. */
export function unsupportedWhatsAppDisplayText(msg: {
  type?: string;
  text?: string;
  content?: string;
  isUnsupported?: boolean;
}): string {
  const t = String(msg.text ?? msg.content ?? '').trim();
  if (t && !/^\[Unsupported message type:/i.test(t)) return t;
  return 'This message could not be displayed. WhatsApp did not send the content to the Business API (common for polls, GIFs, or deleted messages). Ask the customer to resend as text, photo, or document.';
}

export function looksLikeAttachmentFilename(text: string | undefined | null): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  return ATTACHMENT_FILENAME_RE.test(t) || /^\[(document|file)\]$/i.test(t);
}

const IG_SHARED_ATTACHMENT_TYPES = new Set([
  'ig_reel', 'reel', 'ig_post', 'share', 'story', 'ig_story'
]);

const IG_SHARED_PLACEHOLDER_RE =
  /^\[(shared instagram reel|shared instagram story|shared instagram post)\]$/i;

/** Instagram DM shared post / reel / story (Meta webhook attachment, not plain image/video). */
export function isInstagramSharedMedia(msg: {
  platform?: string;
  attachmentType?: string;
  igPostMediaId?: string;
  attachmentUrl?: string;
}): boolean {
  if (msg.platform && msg.platform !== 'instagram') return false;
  const t = String(msg.attachmentType || '').toLowerCase();
  if (IG_SHARED_ATTACHMENT_TYPES.has(t)) return true;
  if (msg.igPostMediaId) return true;
  return false;
}

export function instagramSharedMediaLabel(attachmentType?: string): string {
  const t = String(attachmentType || '').toLowerCase();
  if (t === 'ig_reel' || t === 'reel') return 'Shared Instagram reel';
  if (t === 'story' || t === 'ig_story') return 'Shared Instagram story';
  if (t === 'ig_post' || t === 'share') return 'Shared Instagram post';
  return 'Shared Instagram media';
}

export function isInstagramSharedPlaceholderText(content: string | undefined | null): boolean {
  if (!content || typeof content !== 'string') return false;
  return IG_SHARED_PLACEHOLDER_RE.test(content.trim());
}

/** Infer file attachment when WhatsApp stored filename as text + mediaId (no attachmentUrl). */
export function inferIncomingAttachmentType(msg: {
  attachmentType?: string;
  type?: string;
  mediaId?: string;
  text?: string;
}): string | undefined {
  const raw = msg.attachmentType;
  if (raw === 'file' || raw === 'document') return 'file';
  if (msg.mediaId && msg.type === 'document') return 'file';
  if (looksLikeAttachmentFilename(msg.text)) return 'file';
  return raw;
}

export function incomingFileDisplayName(msg: {
  attachmentDisplayName?: string;
  text?: string;
  content?: string;
  attachmentUrl?: string;
}): string {
  const named = msg.attachmentDisplayName?.trim();
  if (named) return named;
  const text = String(msg.text ?? msg.content ?? '').trim();
  if (looksLikeAttachmentFilename(text)) return text;
  return inboxAttachmentFilenameFromUrl(msg.attachmentUrl);
}

export function inboxAttachmentFilenameFromUrl(url: string | undefined | null, fallback = 'document.pdf'): string {
  if (!url || typeof url !== 'string') return fallback;
  try {
    const base = url.split('?')[0];
    const last = base.split('/').pop();
    if (!last) return fallback;
    const decoded = decodeURIComponent(last);
    return decoded && decoded !== '/' ? decoded : fallback;
  } catch {
    return fallback;
  }
}

export function inboxReplyPdfDisplayName(reply: {
  attachmentUrl?: string;
  attachmentType?: string | undefined;
  attachmentDisplayName?: string;
  content?: string;
}): string {
  if (reply.attachmentType !== 'file' && !looksLikeAttachmentFilename(reply.content)) return '';
  const fromMsg = incomingFileDisplayName(reply);
  if (fromMsg && fromMsg !== 'document.pdf') return fromMsg;
  const n = reply.attachmentDisplayName?.trim();
  if (n) return n;
  return inboxAttachmentFilenameFromUrl(reply.attachmentUrl);
}

export async function downloadInboxAttachmentFile(url: string, suggestedFilename: string): Promise<void> {
  const name = suggestedFilename?.trim() || inboxAttachmentFilenameFromUrl(url);
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = obj;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
