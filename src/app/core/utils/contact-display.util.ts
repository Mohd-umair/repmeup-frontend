import { IContact } from '../models/contact.model';

/**
 * First channel avatar with a non-empty URL (order is not guaranteed on `channels[0]`).
 */
export function getContactAvatarUrl(contact: IContact | null | undefined): string | null {
  if (!contact?.channels?.length) return null;
  for (const ch of contact.channels) {
    const u = typeof ch.avatarUrl === 'string' ? ch.avatarUrl.trim() : '';
    if (u) return u;
  }
  return null;
}
