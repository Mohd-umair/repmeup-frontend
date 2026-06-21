import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IAuthor } from '../models/interaction.model';
import { IContact, IContactChannel } from '../models/contact.model';

const AVATAR_CHANNEL_PRIORITY = ['instagram', 'facebook', 'whatsapp', 'linkedin', 'twitter', 'youtube', 'google'];

function pickBestAvatarChannel(channels: IContactChannel[] | undefined | null): IContactChannel | null {
  if (!channels?.length) return null;
  for (const platform of AVATAR_CHANNEL_PRIORITY) {
    const ch = channels.find(c => c.platform?.toLowerCase() === platform && c.platformUserId);
    if (ch) return ch;
  }
  return channels.find(c => c.platformUserId) || null;
}

const MAX_CACHE = 300;
/** Sentinel: key was tried and failed. Retried after FAILED_TTL_MS so transient
 *  errors (expired CDN signature, momentary token/network blip) self-heal. */
const FAILED = '__FAILED__';
/** How long a failed lookup is suppressed before we allow a retry (5 min). */
const FAILED_TTL_MS = 5 * 60 * 1000;

export interface InstagramSharedMediaMeta {
  label: string;
  permalink: string | null;
  mediaType: string | null;
  hasPreview: boolean;
}

/**
 * Industry-standard avatar strategy for the inbox:
 *
 * 1. During sync / webhook, the backend resolves the actual CDN URL
 *    (fbsbx.com / lookaside.fbsbx.com) and stores it in `author.avatarUrl`.
 *    CDN URLs are publicly accessible — no proxy, no auth header needed.
 *
 * 2. Legacy records may store `graph.facebook.com/{id}/picture` (Facebook or Instagram
 *    PSIDs). Those require a Page access token — proxy via `/api/inbox/avatar/facebook/:id`
 *    or `/api/inbox/avatar/instagram/:id` so the backend adds the token.
 *
 * 3. If no URL is stored at all, or if the CDN URL has expired (Facebook CDN URLs are
 *    time-limited), we fall back to an initials avatar immediately rather than hammering
 *    the API.
 *
 * 4. Failures (404, 403, network error) are cached with a FAILED sentinel so the same
 *    key is never retried for the lifetime of the page.
 *
 * 5. In-flight deduplication: concurrent calls for the same key share one HTTP request.
 */
@Injectable({ providedIn: 'root' })
export class InboxAvatarService {
  private readonly apiUrl = environment.apiUrl;
  /** key → resolved blob/CDN URL, or FAILED sentinel */
  private resolved = new Map<string, string>();
  private keyOrder: string[] = [];
  /** key → epoch ms when a FAILED entry was recorded (for TTL-based retry) */
  private failedAt = new Map<string, number>();
  /** in-flight observables, keyed by cache key */
  private inFlight = new Map<string, Observable<string | null>>();
  /** cached IG shared-media metadata (post/reel/story in DM) */
  private metaCache = new Map<string, InstagramSharedMediaMeta | null>();

  constructor(private http: HttpClient) {}

  /**
   * Reads the cache for a key. Returns:
   *  - a string URL when a successful result is cached,
   *  - null when a FAILED result is still within its TTL (caller shows initials),
   *  - undefined when there is no usable cache entry (caller should fetch).
   * Expired FAILED entries are evicted so the next call re-fetches.
   */
  private readCache(key: string): string | null | undefined {
    const cached = this.resolved.get(key);
    if (cached === undefined) return undefined;
    if (cached !== FAILED) return cached;
    const ts = this.failedAt.get(key) || 0;
    if (Date.now() - ts < FAILED_TTL_MS) return null; // still suppressed
    // TTL elapsed → drop the failed entry and allow a retry
    this.resolved.delete(key);
    this.failedAt.delete(key);
    return undefined;
  }

  /**
   * Returns an observable that emits the avatar URL to bind to [src], or null (show initials).
   * @param pageId Optional; for Facebook, pass to use the correct page token when org has multiple pages.
   * @param threadPlatformId Optional; `dm_<pageOrAccountId>_<userId>` — used to derive Facebook pageId when metadata is missing.
   */
  getAvatarUrl(
    platform: string,
    author: IAuthor | undefined | null,
    pageId?: string,
    threadPlatformId?: string
  ): Observable<string | null> {
    if (!author) return of(null);

    const storedUrl = author.avatarUrl || author.profilePicture || null;
    const platformKey = (platform || '').toLowerCase();
    let resolvedPageId = pageId;
    if (!resolvedPageId && platformKey === 'facebook' && threadPlatformId?.startsWith('dm_')) {
      const parts = threadPlatformId.split('_');
      if (parts.length >= 3) resolvedPageId = parts[1];
    }

    // --- Facebook path ---
    // Always proxy: CDN URLs have time-limited signatures and expire. Proxy adds backend token + caches.
    if (platformKey === 'facebook') {
      if (!author.platformId) return of(null);
      const proxyKey = resolvedPageId ? `proxy_fb_${author.platformId}_${resolvedPageId}` : `proxy_fb_${author.platformId}`;
      const proxyUrl = resolvedPageId
        ? `${this.apiUrl}/inbox/avatar/facebook/${encodeURIComponent(author.platformId)}?pageId=${encodeURIComponent(resolvedPageId)}`
        : `${this.apiUrl}/inbox/avatar/facebook/${encodeURIComponent(author.platformId)}`;
      return this.fetchViaProxy(proxyKey, proxyUrl);
    }

    // --- Instagram path ---
    // Always proxy: CDN URLs expire, and IGAA-token connections cannot serve customer pics at all.
    // Proxy handles token resolution (EAA > IGAA) and re-fetches when stored CDN has expired.
    if (platformKey === 'instagram') {
      if (!author.platformId) return of(null);
      const proxyKey = `proxy_ig_${author.platformId}`;
      const proxyUrl = `${this.apiUrl}/inbox/avatar/instagram/${encodeURIComponent(author.platformId)}`;
      return this.fetchViaProxy(proxyKey, proxyUrl);
    }

    // WhatsApp: Meta does not expose customer profile pictures via API — show initials.
    if (platformKey === 'whatsapp') {
      return of(null);
    }

    if (storedUrl && isGraphPictureUrl(storedUrl) && author.platformId) {
      return this.fetchViaProxy(
        `proxy_generic_${platformKey}_${author.platformId}`,
        `${this.apiUrl}/inbox/avatar/${encodeURIComponent(platformKey)}/${encodeURIComponent(author.platformId)}`
      );
    }

    return of(storedUrl);
  }

  /**
   * Contact list/detail avatar — same proxy rules as inbox (Graph URLs need backend token).
   */
  getContactAvatarUrl$(contact: IContact | null | undefined, threadPlatformId?: string): Observable<string | null> {
    if (!contact) return of(null);
    const channel = pickBestAvatarChannel(contact.channels);
    if (!channel?.platformUserId) return of(null);

    const author: IAuthor = {
      platformId: channel.platformUserId,
      name: channel.name || contact.primaryName,
      username: channel.username,
      avatarUrl: channel.avatarUrl,
      profilePicture: channel.avatarUrl
    };
    return this.getAvatarUrl(channel.platform, author, undefined, threadPlatformId);
  }

  /**
   * WhatsApp inbound media — same blob-proxy pattern as Facebook attachments (auth header).
   */
  getWhatsAppAttachmentUrl(interactionId: string, mid: string): Observable<string | null> {
    if (!interactionId || !mid) return of(null);
    const key = `wa_att_${interactionId}_${mid}`;
    const cached = this.readCache(key);
    if (cached !== undefined) return of(cached);
    const url = `${this.apiUrl}/inbox/whatsapp-media?interactionId=${encodeURIComponent(interactionId)}&mid=${encodeURIComponent(mid)}`;
    return this.fetchViaProxy(key, url);
  }

  /**
   * Metadata for a shared Instagram post/reel/story in DM (permalink + label).
   */
  getInstagramSharedMediaMeta(interactionId: string, mid: string): Observable<InstagramSharedMediaMeta | null> {
    if (!interactionId || !mid) return of(null);
    const key = `igshare_${interactionId}_${mid}`;
    const cached = this.metaCache.get(key);
    if (cached !== undefined) return of(cached);

    const url =
      `${this.apiUrl}/inbox/instagram-shared-media?interactionId=${encodeURIComponent(interactionId)}` +
      `&mid=${encodeURIComponent(mid)}`;
    return this.http.get<{ success: boolean; data?: InstagramSharedMediaMeta }>(url).pipe(
      map((res) => {
        const data = res?.success && res.data ? res.data : null;
        this.metaCache.set(key, data);
        return data;
      }),
      catchError(() => {
        this.metaCache.set(key, null);
        return of(null);
      }),
      shareReplay(1)
    );
  }

  /**
   * Fetch a Facebook/Instagram DM attachment via the backend proxy (adds page/IG token).
   */
  getAttachmentUrl(interactionId: string, mid: string): Observable<string | null> {
    if (!interactionId || !mid) return of(null);
    const key = `att_${interactionId}_${mid}`;
    const cached = this.readCache(key);
    if (cached !== undefined) return of(cached);
    const url = `${this.apiUrl}/inbox/attachment?interactionId=${encodeURIComponent(interactionId)}&mid=${encodeURIComponent(mid)}`;
    return this.fetchViaProxy(key, url);
  }

  private fetchViaProxy(key: string, url: string): Observable<string | null> {
    const cached = this.readCache(key);
    if (cached !== undefined) return of(cached);

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const obs: Observable<string | null> = this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.setCache(key, blobUrl);
        this.inFlight.delete(key);
        return blobUrl as string | null;
      }),
      catchError(() => {
        this.setCache(key, FAILED);
        this.inFlight.delete(key);
        return of(null as string | null);
      }),
      shareReplay(1)
    );

    this.inFlight.set(key, obs);
    return obs;
  }

  private setCache(key: string, value: string): void {
    if (this.resolved.size >= MAX_CACHE && this.keyOrder.length > 0) {
      const oldest = this.keyOrder.shift()!;
      const old = this.resolved.get(oldest);
      if (old && old !== FAILED && old.startsWith('blob:')) URL.revokeObjectURL(old);
      this.resolved.delete(oldest);
      this.failedAt.delete(oldest);
    }
    this.resolved.set(key, value);
    // Stamp failures for TTL-based retry; clear any stale stamp on success.
    if (value === FAILED) {
      this.failedAt.set(key, Date.now());
    } else {
      this.failedAt.delete(key);
    }
    this.keyOrder.push(key);
  }
}

/** Graph `/picture` redirect URLs require a Page token — never bind directly in `<img>`. */
function isGraphPictureUrl(url: string): boolean {
  return url.includes('graph.facebook.com') && url.includes('/picture');
}
