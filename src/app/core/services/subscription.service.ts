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

/** WhatsApp pass-through spend, aggregated and formatted by the backend. */
export interface IWhatsAppSpend {
  periodMonthKey: string | null;
  totalInr: number;
  totalDisplay: string;
  conversations: number;
  messages: number;
  categories: Array<{
    category: string;
    label: string;
    conversations: number;
    messages: number;
    amountInr: number;
    amountDisplay: string;
  }>;
}

/** A purchasable add-on, priced for the caller's current plan. */
export interface IAddOnOffer {
  addOnId: string;
  name: string;
  description: string;
  kind: 'one_time' | 'recurring';
  quantityLabel: string;
  grantUnit: string | null;
  featureKey: string;
  mode: 'limit_delta' | 'period_credit' | 'boolean_grant';
  priceInr: number;
  priceDisplay: string;
  grantAmount: number | null;
  /** e.g. "₹1,000 → +1,500 contacts" — already formatted. */
  offerDisplay: string;
  minQuantity: number;
  maxQuantity: number;
  /** false when an admin hasn't configured how much one unit grants. */
  purchasable: boolean;
}

/** A recurring add-on the org is currently paying for. */
export interface IMyRecurringAddOn {
  addOnId: string;
  quantity: number;
  status: 'pending' | 'active' | 'past_due' | 'cancelled';
  unitPriceInr: number;
  currentPeriodEnd: string | null;
  /** Cancelled, but still granting until the paid period runs out. */
  cancelAtPeriodEnd: boolean;
}

/** What this org has bought: recurring subscriptions plus recent one-time grants. */
export interface IMyAddOns {
  recurring: IMyRecurringAddOn[];
  recentGrants: Array<{
    addOnId: string;
    featureKey: string;
    amount: number;
    grantedAt: string;
    periodMonthKey: string;
  }>;
  overrides: Record<string, { limitDelta?: number; enabled?: boolean; periodMonthKey?: string }>;
}

/** One pricing-sheet meter, formatted by the backend. */
export interface IPlanMeter {
  featureKey: string;
  label: string;
  used: number;
  /** Plan allowance plus any purchased top-up. -1 = unlimited. */
  limit: number;
  /** Allowance from the plan alone, before top-ups. */
  baseLimit: number;
  /** Extra capacity bought via add-ons; 0 when none. */
  purchasedDelta: number;
  remaining: number | null;
  isUnlimited: boolean;
  isExhausted: boolean;
  percentUsed: number;
  /** e.g. "1,240 / 2,500" — already localised. */
  display: string;
  resetPeriod: string;
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
  /**
   * The pricing-sheet meters. Resolved through the entitlements engine (live counts
   * and purchased top-ups), and already formatted — render, don't recompute.
   */
  meters?: {
    aiConversations: IPlanMeter | null;
    activeContacts: IPlanMeter | null;
    /** Contacts dropped this month because the org was at its ceiling. */
    contactsNotSaved: number;
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
  /**
   * Both billing legs, formatted by the backend. `annual` is null when the plan is
   * monthly-only — that is what decides whether an annual option can be offered.
   */
  pricing?: {
    monthly: { amount: number | string; display: string; suffix: string | null };
    annual: {
      amount: number;
      display: string;
      suffix: string | null;
      perMonthEquivalentDisplay: string | null;
      strikeThrough: string | null;
      savingsPercent: number | null;
      savingsLabel: string | null;
    } | null;
  };
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

  /** Meta's WhatsApp conversation charges for this org — a pass-through cost. */
  getWhatsAppSpend(): Observable<{ success: boolean; data?: IWhatsAppSpend; error?: string }> {
    return this.http.get<{ success: boolean; data?: IWhatsAppSpend; error?: string }>(
      `${this.apiUrl}/whatsapp-spend`
    );
  }

  /** Add-ons purchasable on the current plan, priced and formatted by the backend. */
  getAvailableAddOns(): Observable<{ success: boolean; data?: { items: IAddOnOffer[] }; error?: string }> {
    return this.http.get<{ success: boolean; data?: { items: IAddOnOffer[] }; error?: string }>(
      `${environment.apiUrl}/addons`
    );
  }

  /** Add-ons this org already owns, plus the capacity they granted. */
  getMyAddOns(): Observable<{ success: boolean; data?: IMyAddOns; error?: string }> {
    return this.http.get<{ success: boolean; data?: IMyAddOns; error?: string }>(
      `${environment.apiUrl}/addons/mine`
    );
  }

  /**
   * Stop a recurring add-on. Cancels at the end of the paid period by default —
   * the customer keeps what they paid for until it expires.
   */
  cancelAddOnSubscription(addOnId: string): Observable<{ success: boolean; data?: any; error?: string }> {
    return this.http.delete<{ success: boolean; data?: any; error?: string }>(
      `${environment.apiUrl}/addons/${encodeURIComponent(addOnId)}/subscription`
    );
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
