import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IAuthor } from '../models/interaction.model';

const MAX_CACHE = 300;
/** Sentinel: key was tried and failed — never retry. */
const FAILED = '__FAILED__';

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
  /** in-flight observables, keyed by cache key */
  private inFlight = new Map<string, Observable<string | null>>();

  constructor(private http: HttpClient) {}

  /**
   * Returns an observable that emits the avatar URL to bind to [src], or null (show initials).
   * @param pageId Optional; for Facebook, pass to use the correct page token when org has multiple pages.
   */
  getAvatarUrl(platform: string, author: IAuthor | undefined | null, pageId?: string): Observable<string | null> {
    if (!author) return of(null);

    const storedUrl = author.avatarUrl || author.profilePicture || null;
    const platformKey = (platform || '').toLowerCase();

    // --- Facebook path ---
    if (platformKey === 'facebook') {
      if (!author.platformId) return of(null);
      if (storedUrl && isFacebookCdnUrl(storedUrl)) {
        const key = `cdn_${storedUrl}`;
        const cached = this.resolved.get(key);
        if (cached !== undefined) return of(cached === FAILED ? null : cached);
        this.setCache(key, storedUrl);
        return of(storedUrl);
      }
      const proxyKey = pageId ? `proxy_fb_${author.platformId}_${pageId}` : `proxy_fb_${author.platformId}`;
      const proxyUrl = pageId
        ? `${this.apiUrl}/inbox/avatar/facebook/${encodeURIComponent(author.platformId)}?pageId=${encodeURIComponent(pageId)}`
        : `${this.apiUrl}/inbox/avatar/facebook/${encodeURIComponent(author.platformId)}`;
      return this.fetchViaProxy(proxyKey, proxyUrl);
    }

    // --- Instagram path (same Graph picture semantics; browser cannot load graph URLs without token) ---
    if (platformKey === 'instagram') {
      if (!author.platformId) return of(null);
      if (storedUrl && isFacebookCdnUrl(storedUrl)) {
        const key = `cdn_${storedUrl}`;
        const cached = this.resolved.get(key);
        if (cached !== undefined) return of(cached === FAILED ? null : cached);
        this.setCache(key, storedUrl);
        return of(storedUrl);
      }
      const proxyKey = `proxy_ig_${author.platformId}`;
      const proxyUrl = `${this.apiUrl}/inbox/avatar/instagram/${encodeURIComponent(author.platformId)}`;
      return this.fetchViaProxy(proxyKey, proxyUrl);
    }

    return of(storedUrl);
  }

  /**
   * WhatsApp inbound media — same blob-proxy pattern as Facebook attachments (auth header).
   */
  getWhatsAppAttachmentUrl(interactionId: string, mid: string): Observable<string | null> {
    if (!interactionId || !mid) return of(null);
    const key = `wa_att_${interactionId}_${mid}`;
    const cached = this.resolved.get(key);
    if (cached !== undefined) return of(cached === FAILED ? null : cached);
    const url = `${this.apiUrl}/inbox/whatsapp-media?interactionId=${encodeURIComponent(interactionId)}&mid=${encodeURIComponent(mid)}`;
    return this.fetchViaProxy(key, url);
  }

  /**
   * Fetch a Facebook DM attachment image via the backend proxy (adds page token).
   */
  getAttachmentUrl(interactionId: string, mid: string): Observable<string | null> {
    if (!interactionId || !mid) return of(null);
    const key = `att_${interactionId}_${mid}`;
    const cached = this.resolved.get(key);
    if (cached !== undefined) return of(cached === FAILED ? null : cached);
    const url = `${this.apiUrl}/inbox/attachment?interactionId=${encodeURIComponent(interactionId)}&mid=${encodeURIComponent(mid)}`;
    return this.fetchViaProxy(key, url);
  }

  private fetchViaProxy(key: string, url: string): Observable<string | null> {
    const cached = this.resolved.get(key);
    if (cached !== undefined) return of(cached === FAILED ? null : cached);

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
    }
    this.resolved.set(key, value);
    this.keyOrder.push(key);
  }
}

/** True for Meta CDN domains that are publicly accessible without auth. */
function isFacebookCdnUrl(url: string): boolean {
  return (
    url.includes('fbsbx.com') ||
    url.includes('lookaside.fbsbx.com') ||
    url.includes('platform-lookaside.fbsbx.com') ||
    url.includes('scontent.') ||
    url.includes('fbcdn.net') ||
    url.includes('cdninstagram.com')
  );
}
