import { IContact, IContactChannel } from '../models/contact.model';

const AVATAR_CHANNEL_PRIORITY = ['instagram', 'facebook', 'whatsapp', 'linkedin', 'twitter', 'youtube', 'google'];

/**
 * Pick the best channel for avatar resolution (FB/IG first — proxy-backed profile pics).
 */
export function pickBestAvatarChannel(channels: IContactChannel[] | undefined | null): IContactChannel | null {
  if (!channels?.length) return null;
  for (const platform of AVATAR_CHANNEL_PRIORITY) {
    const ch = channels.find(c => c.platform?.toLowerCase() === platform && c.platformUserId);
    if (ch) return ch;
  }
  return channels.find(c => c.platformUserId) || null;
}

/**
 * @deprecated Prefer InboxAvatarService.getContactAvatarUrl$ — raw Graph URLs are not browser-loadable.
 * First channel avatar with a non-empty URL (order is not guaranteed on `channels[0]`).
 */
export function getContactAvatarUrl(contact: IContact | null | undefined): string | null {
  const ch = pickBestAvatarChannel(contact?.channels);
  const u = typeof ch?.avatarUrl === 'string' ? ch.avatarUrl.trim() : '';
  return u || null;
}
