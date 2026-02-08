import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
  };
  canConnectMore: boolean;
  remaining: number;
  nextTier?: {
    name: string;
    tier: number;
    maxAccounts: number;
    price: number | string;
  };
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
    lastResetAt: Date;
  };
  status: string;
  features: string[];
}

export interface IPlanTier {
  name: string;
  tier: number;
  price: number | string;
  limits: {
    maxAccounts: number;
    maxUsers: number;
    maxPostsPerMonth: number;
    maxAutoRepliesPerMonth: number;
    maxAICreditsPerMonth: number;
  };
  features: string[];
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
   * Calculate usage percentage
   */
  getUsagePercentage(usage: number, limit: number): number {
    if (limit === -1) return 0; // Unlimited
    return Math.min(100, (usage / limit) * 100);
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
