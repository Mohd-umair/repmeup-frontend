import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Avatar Service - Fetches author profile pictures via backend proxy (avoids CORS).
 * Caches blob URLs by platform_userId to avoid refetching.
 */
@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  private readonly apiUrl = environment.apiUrl;
  private cache = new Map<string, string>();

  constructor(private http: HttpClient) {}

  /**
   * Get avatar URL for an author. Uses backend proxy for Instagram/Facebook so auth is sent.
   * Returns Observable of blob URL, or null if not applicable or on error.
   */
  getAvatarUrl(platform: string, userId: string): Observable<string | null> {
    if (!platform || !userId) return of(null);
    const key = `${platform}_${userId}`;
    const cached = this.cache.get(key);
    if (cached) return of(cached);

    const url = `${this.apiUrl}/inbox/avatar/${encodeURIComponent(platform)}/${encodeURIComponent(userId)}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map(blob => {
        const blobUrl = URL.createObjectURL(blob);
        this.cache.set(key, blobUrl);
        return blobUrl;
      }),
      catchError(() => of(null))
    );
  }

  /** Revoke a cached blob URL (call when no longer needed to free memory). */
  revoke(key: string): void {
    const url = this.cache.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.cache.delete(key);
    }
  }

  getCacheKey(platform: string, userId: string): string {
    return `${platform}_${userId}`;
  }
}
