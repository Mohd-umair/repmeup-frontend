/**
 * Labels and download helpers for file/PDF attachments in inbox threads.
 */

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
}): string {
  if (reply.attachmentType !== 'file' || !reply.attachmentUrl) return '';
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
