import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SocketService } from './socket.service';

/**
 * Resolved entitlement entry — mirrors the backend `entitlementsService.keys[key]`.
 */
export interface ResolvedEntitlement {
  kind: 'boolean' | 'limit' | 'enum' | 'list' | 'json';
  enabled?: boolean;
  limit?: number;
  value?: unknown;
  source?: string;
}

export interface EntitlementsSnapshot {
  source: string;
  planId: string;
  planName: string;
  tier: number;
  /** legacy shape — `{ maxAccounts, maxUsers, ... }`. Prefer `keys` for new code. */
  limits: Record<string, number>;
  /** Catalog-keyed entitlements map. */
  keys: Record<string, ResolvedEntitlement>;
  features: string[];
  usage: Record<string, number | Date | null>;
  usageBuckets: Record<string, { used: number; periodStart?: string }>;
  status: string;
  isActive: boolean;
  billingCycle?: string | null;
  currentPeriodEnd?: string | null;
}

/**
 * Stable list of feature keys consumed by the FE. Mirrors backend FEATURE_KEYS.
 *
 * Centralizing them here avoids stringly-typed lookups scattered across templates
 * and lets TS catch typos at compile time.
 */
export const FEATURE_KEY = {
  USERS_MAX: 'users.max',
  ACCOUNTS_MAX: 'accounts.max',
  STORAGE_GB: 'storage.gb',
  API_CALLS_DAILY: 'api.calls.daily',

  CREDITS_AUTO_REPLY: 'credits.autoReply.monthly',
  CREDITS_POST_CREATION: 'credits.postCreation.monthly',
  CREDITS_AI_GENERAL: 'credits.ai.monthly',

  INBOX_UNIQUE_CONTACTS: 'inbox.uniqueContacts.monthly',
  INBOX_BUCKET_CHAT: 'inbox.bucket.chat',
  INBOX_BUCKET_CREATE: 'inbox.bucket.create',

  KB_ENTRIES_MAX: 'kb.entries.max',
  KB_UPLOAD_URL: 'kb.upload.url',
  KB_UPLOAD_PDF: 'kb.upload.pdf',

  POSTS_PER_MONTH: 'posts.perMonth',
  POSTS_PLATFORMS_MAX: 'posts.platforms.maxPerPost',
  POSTS_AI_VARIANTS_MAX: 'posts.ai.variants.max',
  POSTS_TRENDS: 'posts.trends',
  POSTS_LOGO: 'posts.logo',
  POSTS_SAVE_DRAFT: 'posts.saveDraft',

  AUTO_REPLY_ENABLED: 'automation.autoReply.enabled',
  ANALYTICS_ADVANCED: 'analytics.advanced',
  AGENTS_ENABLED: 'agents.enabled',
  VOICE_IVR_ENABLED: 'voice.ivr.enabled',

  COMMERCE_PRODUCTS_MAX: 'commerce.products.max',
  COMMERCE_WA_CATALOG_ENABLED: 'commerce.whatsappCatalog.enabled',
  COMMERCE_AI_ASSIST_ENABLED: 'commerce.aiAssist.enabled',
  COMMERCE_AUTONOMOUS_AGENT: 'commerce.autonomousAgent.enabled',

  CAMPAIGNS_ENABLED: 'campaigns.enabled',
  CAMPAIGNS_RECIPIENTS_MONTHLY: 'campaigns.recipients.monthly',
  WHATSAPP_TEMPLATES_MAX: 'whatsapp.templates.max',
  WHATSAPP_BROADCAST_ENABLED: 'whatsapp.broadcast.enabled',
  AUTOMATION_FLOWS_MAX: 'automation.flows.max',
  CONTACTS_MAX: 'contacts.max'
} as const;

export type FeatureKey = (typeof FEATURE_KEY)[keyof typeof FEATURE_KEY];

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * EntitlementsStore — single source of truth for "what can the current org do?".
 *
 * Templates collapse to:
 *   <button *ngIf="ent.can(FEATURE_KEY.POSTS_SAVE_DRAFT)">Save draft</button>
 *   <input  [disabled]="!ent.can(FEATURE_KEY.KB_UPLOAD_URL)" />
 *   <span>{{ ent.remaining(FEATURE_KEY.CREDITS_AUTO_REPLY) }} replies left</span>
 *
 * Lifecycle:
 *   - `load()` is called once after login (or on app bootstrap when a token exists).
 *   - The server pushes `entitlements:invalidated` over the existing socket on
 *     plan/subscription changes; we re-fetch automatically.
 *   - All state is exposed as signals so templates can read synchronously.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsStore {
  private readonly api = inject(ApiService);
  private readonly socket = inject(SocketService);

  /** Internal raw snapshot. `null` until first load completes. */
  private readonly _snapshot = signal<EntitlementsSnapshot | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly snapshot = computed(() => this._snapshot());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  /** True after the first successful (or failed) load. */
  readonly isReady = computed(() => this._snapshot() !== null);

  /** Plan summary (for header chips, settings page, etc.) */
  readonly planSummary = computed(() => {
    const s = this._snapshot();
    if (!s) return null;
    return {
      planId: s.planId,
      planName: s.planName,
      tier: s.tier,
      status: s.status,
      isActive: s.isActive,
      currentPeriodEnd: s.currentPeriodEnd ?? null
    };
  });

  /** Convenience read of the resolved keys map. */
  readonly keys = computed(() => this._snapshot()?.keys ?? {});

  private socketWired = false;

  /** Force-fetch the resolved snapshot for the current org. */
  load(): void {
    this._loading.set(true);
    this._error.set(null);
    this.api
      .get<ApiEnvelope<EntitlementsSnapshot>>('/entitlements')
      .pipe(
        tap((res) => {
          if (res?.success && res.data) {
            this._snapshot.set(res.data);
            this._error.set(null);
          } else {
            this._error.set(res?.error || 'Failed to load entitlements');
          }
          this._loading.set(false);
        }),
        catchError((err) => {
          this._loading.set(false);
          this._error.set(err?.error?.error || 'Failed to load entitlements');
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Wire socket invalidation. Safe to call repeatedly — installs listeners only
   * once. The backend should emit `entitlements:invalidated` after upgrade,
   * cancel, plan template edit, or admin toggle.
   */
  wireSocketInvalidation(): void {
    if (this.socketWired) return;
    this.socketWired = true;
    this.socket
      .listen<unknown>('entitlements:invalidated')
      .subscribe(() => this.load());
  }

  /** Boolean check — fail closed while loading; limit keys fail open until snapshot exists. */
  can(featureKey: FeatureKey): boolean {
    const snap = this._snapshot();
    if (!snap) {
      if (this._loading()) return false;
      return true;
    }
    const entry = snap.keys?.[featureKey];
    if (!entry) return true;
    if (entry.kind === 'boolean') return !!entry.enabled;
    if (entry.kind === 'limit') return entry.limit !== 0;
    return true;
  }

  /** Numeric limit; -1 means unlimited; undefined means no entry. */
  limit(featureKey: FeatureKey): number | undefined {
    const entry = this._snapshot()?.keys?.[featureKey];
    return entry?.kind === 'limit' ? entry.limit : undefined;
  }

  /**
   * Used count for a `limit` feature, derived from `usageBuckets[key]` first,
   * falling back to legacy `usage.*` only when the bucket is absent.
   */
  used(featureKey: FeatureKey): number {
    const snap = this._snapshot();
    if (!snap) return 0;
    const bucket = snap.usageBuckets?.[featureKey];
    if (bucket?.used != null) return Number(bucket.used) || 0;
    const legacyMap: Partial<Record<FeatureKey, keyof EntitlementsSnapshot['usage']>> = {
      [FEATURE_KEY.POSTS_PER_MONTH]: 'postsThisMonth',
      [FEATURE_KEY.CREDITS_AUTO_REPLY]: 'autoRepliesThisMonth',
      [FEATURE_KEY.CREDITS_AI_GENERAL]: 'aiCreditsThisMonth',
      [FEATURE_KEY.ACCOUNTS_MAX]: 'connectedAccounts',
      [FEATURE_KEY.USERS_MAX]: 'activeUsers'
    };
    const legacyKey = legacyMap[featureKey];
    if (!legacyKey) return 0;
    const v = snap.usage?.[legacyKey];
    return typeof v === 'number' ? v : 0;
  }

  /** Remaining headroom; Infinity when unlimited. */
  remaining(featureKey: FeatureKey): number {
    const lim = this.limit(featureKey);
    if (lim === undefined) return Infinity;
    if (lim === -1) return Infinity;
    return Math.max(0, lim - this.used(featureKey));
  }

  /** True when a `limit` feature has a finite limit (i.e. NOT unlimited). */
  isCapped(featureKey: FeatureKey): boolean {
    const lim = this.limit(featureKey);
    return typeof lim === 'number' && lim !== -1;
  }

  /** True when usage has reached or exceeded the limit. */
  isExhausted(featureKey: FeatureKey): boolean {
    if (!this.isCapped(featureKey)) return false;
    return this.used(featureKey) >= (this.limit(featureKey) as number);
  }

  /** Generic enum/list/json reader. */
  value<T = unknown>(featureKey: FeatureKey): T | undefined {
    const entry = this._snapshot()?.keys?.[featureKey];
    return entry?.value as T | undefined;
  }

  /** Reset the store (e.g. on logout). */
  clear(): void {
    this._snapshot.set(null);
    this._error.set(null);
    this._loading.set(false);
  }

  /** Access the snapshot as a plain object (for use in services that don't pipe). */
  current(): EntitlementsSnapshot | null {
    return this._snapshot();
  }

  /**
   * Eagerly resolve a snapshot when none has been loaded yet.
   * Returns the cached snapshot or fetches one. Useful from interceptors/guards.
   */
  ensureLoaded() {
    return this.api
      .get<ApiEnvelope<EntitlementsSnapshot>>('/entitlements')
      .pipe(
        map((res) => {
          if (res?.success && res.data) {
            this._snapshot.set(res.data);
            return res.data;
          }
          return null;
        }),
        catchError(() => of(null))
      );
  }
}
