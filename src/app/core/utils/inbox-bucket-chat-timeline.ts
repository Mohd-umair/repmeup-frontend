import { IInteraction, IReply } from '../models/interaction.model';

/** Match inbox-detail: image-only webhook placeholders */
export function isImagePlaceholderText(content: string | undefined): boolean {
  if (!content || typeof content !== 'string') return false;
  const t = content.trim();
  return t === '[image]' || t === '[attachment]';
}

export type BucketChatTimelineItem =
  | { kind: 'incoming'; at: Date; text: string; attachmentUrl?: string; attachmentType?: string }
  | { kind: 'reply'; at: Date; reply: IReply };

type RawIncoming = {
  mid?: string;
  text?: string;
  timestamp?: number;
  attachmentUrl?: string;
  attachmentType?: string;
};

function mergeCaptionImagePairs(incoming: RawIncoming[]): RawIncoming[] {
  const mergedIncoming: RawIncoming[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const msg = incoming[i];
    const next = incoming[i + 1];
    const nextIsImageOnly =
      next?.attachmentUrl && next?.attachmentType === 'image' && isImagePlaceholderText(next?.text);
    const prevHasCaption = msg.text && msg.text.trim() && !msg.attachmentUrl;
    const msgIsImageOnly =
      msg.attachmentUrl && msg.attachmentType === 'image' && isImagePlaceholderText(msg.text);
    const nextHasCaption = next?.text && next.text.trim() && !next?.attachmentUrl;
    if (nextIsImageOnly && prevHasCaption) {
      mergedIncoming.push({
        mid: next!.mid,
        text: msg.text,
        timestamp: next!.timestamp ?? msg.timestamp,
        attachmentUrl: next!.attachmentUrl,
        attachmentType: next!.attachmentType
      });
      i++;
    } else if (msgIsImageOnly && nextHasCaption) {
      mergedIncoming.push({
        mid: msg.mid,
        text: next!.text,
        timestamp: next!.timestamp ?? msg.timestamp,
        attachmentUrl: msg.attachmentUrl,
        attachmentType: msg.attachmentType
      });
      i++;
    } else {
      mergedIncoming.push(msg);
    }
  }
  return mergedIncoming;
}

/**
 * Chronological thread for bucket inline chat (DM history + team replies).
 * Aligns with inbox-detail timeline ordering so the latest message is last.
 */
export function buildBucketChatTimeline(interaction: IInteraction | null): BucketChatTimelineItem[] {
  if (!interaction) return [];

  const items: BucketChatTimelineItem[] = [];
  const rawIncoming = (interaction as { metadata?: { incomingMessages?: RawIncoming[] } }).metadata
    ?.incomingMessages;
  const seen = new Set<string>();
  const incoming = Array.isArray(rawIncoming)
    ? rawIncoming.filter((m) => {
        if (!m.mid || seen.has(m.mid)) return false;
        seen.add(m.mid);
        return true;
      })
    : null;

  const fallbackAt = new Date(
    interaction.platformCreatedAt ?? interaction.createdAt ?? Date.now()
  );

  if (incoming && incoming.length > 0) {
    const mergedIncoming = mergeCaptionImagePairs(incoming);
    mergedIncoming.forEach((msg) => {
      const ts = msg.timestamp != null ? new Date(msg.timestamp) : fallbackAt;
      items.push({
        kind: 'incoming',
        at: ts,
        text: msg.text ?? interaction.content ?? '',
        attachmentUrl: msg.attachmentUrl,
        attachmentType: msg.attachmentType
      });
    });
  } else {
    items.push({
      kind: 'incoming',
      at: fallbackAt,
      text: interaction.content ?? ''
    });
  }

  if (interaction.replies?.length) {
    interaction.replies.forEach((reply) => {
      items.push({
        kind: 'reply',
        at: new Date(reply.sentAt),
        reply
      });
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items;
}
