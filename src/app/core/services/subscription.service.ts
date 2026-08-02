import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ISubscriptionBillingInfo {
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  nextBillingAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  planHistory?: Array<{
    planId: string;
    planName: string;
    changedAt: string;
    reason: string | null;
  }>;
}

export interface ISubscriptionLimits {
  plan: string;
  planId: string;
  tier: number;
  status: string;
  limits: {
    maxAccounts: number;
    maxUsers: number;
    maxPostsPerMonth: number;
    maxAutoRepliesPerMonth: number;
    maxAICreditsPerMonth: number;
  };
  usage: {
    connectedAccounts: number;
    activeUsers: number;
    postsThisMonth: number;
    autoRepliesThisMonth: number;
    aiCreditsThisMonth: number;
    carriedCredits?: number;
    creditPeriodStart?: string;
  };
  /** Carry-forward breakdown for AI credits. Present when the plan has a credit limit. */
  creditSummary?: {
    planLimit: number;
    carriedCredits: number;
    effectiveLimit: number;
    remaining: number;
    isUnlimited: boolean;
  };
  canConnectMore: boolean;
  remaining: number;
  nextTier?: {
    planId: string;
    name: string;
    tier: number;
    maxAccounts: number;
    price: number | string;
  };
  billing?: ISubscriptionBillingInfo;
  /** Demo/trial status — null for normal (non-demo) workspaces. */
  trial?: ISubscriptionTrialInfo | null;
}

/** Demo/trial state surfaced from the limits payload. */
export interface ISubscriptionTrialInfo {
  isDemo: boolean;
  demoStatus: 'trialing' | 'locked' | 'converted';
  locked: boolean;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  expired: boolean;
}

export interface ISubscription {
  _id: string;
  organization: string;
  planId: string;
  planName: string;
  tier: number;
  limits: {
    maxAccounts: number;
    maxUsers: number;
    maxPostsPerMonth: number;
    maxAutoRepliesPerMonth: number;
    maxAICreditsPerMonth: number;
  };
  usage: {
    connectedAccounts: number;
    activeUsers: number;
    postsThisMonth: number;
    autoRepliesThisMonth: number;
    aiCreditsThisMonth: number;
    carriedCredits?: number;
    lastResetAt: Date;
    creditPeriodStart?: Date;
  };
  status: string;
  features: string[];
}

export interface IPlanTier {
  name: string;
  tier: number;
  price: number | string;
  description?: string | null;
  limits: {
    maxAccounts: number;
    maxUsers: number;
    maxPostsPerMonth: number;
    maxAutoRepliesPerMonth: number;
    maxAICreditsPerMonth: number;
  };
  /** Processed limit rows from admin entitlements (preferred). */
  highlights?: Array<{
    key: string;
    label: string;
    value: string;
    raw?: number;
  }>;
  /** Enabled module bullets from admin entitlements (preferred). */
  features?: Array<{ key: string; label: string }>;
  /** @deprecated Use `features` — legacy string codes from Plan.features[] */
  legacyFeatures?: string[];
  badge?: string | null;
  badgeColor?: string | null;
  billingCycle?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = `${environment.apiUrl}/subscription`;
  private limitsSubject = new BehaviorSubject<ISubscriptionLimits | null>(null);
  public limits$ = this.limitsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get subscription limits and usage
   */
  getLimits(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/limits`).pipe(
      tap(response => {
        if (response.success) {
          this.limitsSubject.next(response.data);
        }
      })
    );
  }

  /**
   * Check if can connect N more accounts
   */
  checkLimit(accountsToConnect: number = 1): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/check-limit`, { accountsToConnect });
  }

  /**
   * Get full subscription details
   */
  getSubscription(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }

  /**
   * Get all available plans
   */
  getPlans(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/plans`);
  }

  /**
   * Upgrade to a new plan
   */
  upgradePlan(planId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/upgrade`, { planId }).pipe(
      tap(() => {
        // Refresh limits after upgrade
        this.getLimits().subscribe();
      })
    );
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(cancelAtPeriodEnd: boolean = true, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel`, { cancelAtPeriodEnd, reason });
  }

  /**
   * Reactivate a subscription that was scheduled for cancellation at period end
   */
  reactivateSubscription(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reactivate`, {});
  }

  /**
   * Calculate usage percentage (0–100, raw float)
   */
  getUsagePercentage(usage: number, limit: number): number {
    if (limit === -1 || limit <= 0) return 0;
    return Math.min(100, (usage / limit) * 100);
  }

  /**
   * Bar width: same as getUsagePercentage but shows a thin bar when usage > 0 but raw % rounds to 0.
   */
  getUsagePercentageForBar(usage: number, limit: number): number {
    if (limit === -1 || limit <= 0) return 0;
    const pct = Math.min(100, (usage / limit) * 100);
    if (usage > 0 && pct > 0 && pct < 1) return 1;
    return pct;
  }

  /**
   * Label for "X% used" — avoids showing 0% when usage is small vs a large limit (e.g. 5 / 10000).
   */
  formatUsagePercentageLabel(usage: number, limit: number): string {
    if (limit === -1 || limit <= 0) return '—';
    if (usage <= 0) return '0';
    const pct = Math.min(100, (usage / limit) * 100);
    if (pct >= 99.995) return '100';
    if (pct < 1) {
      const rounded = parseFloat(pct.toFixed(2));
      if (usage > 0 && rounded === 0) return '<0.01';
      return String(rounded);
    }
    return String(Math.round(pct));
  }

  /**
   * Check if at or above 90% capacity
   */
  isNearLimit(usage: number, limit: number): boolean {
    if (limit === -1) return false;
    return (usage / limit) >= 0.9;
  }

  /**
   * Check if limit reached
   */
  isLimitReached(usage: number, limit: number): boolean {
    if (limit === -1) return false;
    return usage >= limit;
  }
}
