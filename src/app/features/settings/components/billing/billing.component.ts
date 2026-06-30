import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SubscriptionService,
  ISubscriptionLimits,
  IPlanTier
} from '../../../../core/services/subscription.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RazorpayService } from '../../../../core/services/razorpay.service';
import { formatPlanPriceMonthly } from '../../../../core/utils/plan-price-format';
import {
  IPlanCardData,
  resolvePlanFeatures,
  resolvePlanHighlights,
  sortPlanKeys
} from '../../../../core/utils/plan-presentation.util';
import { AiChatBubbleIconComponent } from '../../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';
import { PlanHighlightsListComponent } from '../../../../shared/components/plan-highlights-list/plan-highlights-list.component';

interface UsageMetric {
  label: string;
  /** Font Awesome classes when iconKind is 'fontawesome' */
  icon: string;
  iconKind?: 'fontawesome' | 'ai-bubble';
  key: keyof ISubscriptionLimits['usage'];
  limitKey: keyof ISubscriptionLimits['limits'];
  color: string;
}

interface PlanCard extends IPlanTier {
  id?: string;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, AiChatBubbleIconComponent, PlanHighlightsListComponent],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss']
})
export class BillingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Expose for template (next-tier price line). */
  readonly formatPlanPriceMonthly = formatPlanPriceMonthly;

  subscriptionLimits: ISubscriptionLimits | null = null;
  allPlans: Record<string, PlanCard> | null = null;

  loadingLimits = true;
  loadingPlans = true;
  upgradingPlan: string | null = null;
  cancellingPlan = false;
  showCancelConfirm = false;
  cancelReason = '';

  readonly usageMetrics: UsageMetric[] = [
    {
      label: 'Connected Accounts',
      icon: 'fas fa-plug',
      key: 'connectedAccounts',
      limitKey: 'maxAccounts',
      color: 'lime'
    },
    {
      label: 'Team Members',
      icon: 'fas fa-users',
      key: 'activeUsers',
      limitKey: 'maxUsers',
      color: 'blue'
    },
    {
      label: 'Posts This Month',
      icon: 'fas fa-calendar-alt',
      key: 'postsThisMonth',
      limitKey: 'maxPostsPerMonth',
      color: 'purple'
    },
    {
      label: 'Reppy AI Replies This Month',
      icon: '',
      iconKind: 'ai-bubble',
      key: 'autoRepliesThisMonth',
      limitKey: 'maxAutoRepliesPerMonth',
      color: 'orange'
    },
    {
      label: 'Reppy Credits This Month',
      icon: 'fas fa-bolt',
      key: 'aiCreditsThisMonth',
      limitKey: 'maxAICreditsPerMonth',
      color: 'green'
    }
  ];

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private razorpayService: RazorpayService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadLimits();
    this.loadPlans();

    this.subscriptionService.limits$
      .pipe(takeUntil(this.destroy$))
      .subscribe(limits => {
        if (limits) {
          this.subscriptionLimits = limits;
          this.loadingLimits = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Data Loading ───────────────────────────────────────────────────────────

  loadLimits(): void {
    this.loadingLimits = true;
    this.subscriptionService.getLimits()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.subscriptionLimits = res.data;
          }
          this.loadingLimits = false;
        },
        error: () => {
          this.loadingLimits = false;
        }
      });
  }

  loadPlans(): void {
    this.loadingPlans = true;
    this.subscriptionService.getPlans()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.allPlans = res.data;
          }
          this.loadingPlans = false;
        },
        error: () => {
          this.loadingPlans = false;
        }
      });
  }

  // ─── Computed / Helpers ─────────────────────────────────────────────────────

  getPlanKeys(): string[] {
    return sortPlanKeys(this.allPlans as Record<string, IPlanCardData> | null);
  }

  getPlan(key: string): PlanCard {
    return this.allPlans![key];
  }

  planHighlights(planId: string) {
    return resolvePlanHighlights(this.getPlan(planId) as IPlanCardData);
  }

  planFeatures(planId: string) {
    return resolvePlanFeatures(this.getPlan(planId) as IPlanCardData);
  }

  isCurrentPlan(planId: string): boolean {
    return this.subscriptionLimits?.planId === planId;
  }

  isUpgrade(planTier: number): boolean {
    if (!this.subscriptionLimits) return false;
    return planTier > this.subscriptionLimits.tier;
  }

  /**
   * Demo/trial workspace. Demo plans run on an unlimited, top-tier internal plan,
   * so no public plan is ever an "upgrade" — without this the purchase CTA never
   * shows and a demo user can't subscribe. We surface a buy button for them instead.
   */
  get isDemo(): boolean {
    return !!this.subscriptionLimits?.trial?.isDemo;
  }

  /** Whether a buy/upgrade CTA should show for a plan card. */
  canPurchasePlan(planTier: number): boolean {
    return this.isDemo || this.isUpgrade(planTier);
  }

  /** CTA label — demo users subscribe to convert; existing customers upgrade. */
  get purchaseCtaLabel(): string {
    return this.isDemo ? 'Get this plan' : 'Upgrade';
  }

  getUsagePercent(metric: UsageMetric): number {
    if (!this.subscriptionLimits) return 0;
    const used = this.subscriptionLimits.usage[metric.key] as number;
    const limit = this.subscriptionLimits.limits[metric.limitKey] as number;
    return this.subscriptionService.getUsagePercentageForBar(used, limit);
  }

  getUsagePercentLabel(metric: UsageMetric): string {
    if (!this.subscriptionLimits) return '0';
    const used = this.subscriptionLimits.usage[metric.key] as number;
    const limit = this.subscriptionLimits.limits[metric.limitKey] as number;
    return this.subscriptionService.formatUsagePercentageLabel(used, limit);
  }

  getUsageValue(key: keyof ISubscriptionLimits['usage']): number {
    return (this.subscriptionLimits?.usage[key] as number) ?? 0;
  }

  getLimitValue(key: keyof ISubscriptionLimits['limits']): number | string {
    const val = this.subscriptionLimits?.limits[key] as number;
    return val === -1 ? '∞' : val;
  }

  isNearLimit(metric: UsageMetric): boolean {
    if (!this.subscriptionLimits) return false;
    const used = this.subscriptionLimits.usage[metric.key] as number;
    const limit = this.subscriptionLimits.limits[metric.limitKey] as number;
    return this.subscriptionService.isNearLimit(used, limit);
  }

  isAtLimit(metric: UsageMetric): boolean {
    if (!this.subscriptionLimits) return false;
    const used = this.subscriptionLimits.usage[metric.key] as number;
    const limit = this.subscriptionLimits.limits[metric.limitKey] as number;
    return this.subscriptionService.isLimitReached(used, limit);
  }

  getBarColor(metric: UsageMetric): string {
    if (this.isAtLimit(metric)) return 'bg-red-500';
    if (this.isNearLimit(metric)) return 'bg-amber-500';
    const map: Record<string, string> = {
      lime: 'bg-lime-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      orange: 'bg-orange-500',
      green: 'bg-green-500'
    };
    return map[metric.color] ?? 'bg-gray-500';
  }

  getStatusColor(): string {
    const s = this.subscriptionLimits?.status ?? '';
    if (s === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (s === 'trial') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (s === 'cancelled' || s === 'expired') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }

  formatPrice(price: number | string): string {
    const full = formatPlanPriceMonthly(price);
    if (typeof price === 'number' && price > 0) {
      return full.replace(/\/mo$/, '');
    }
    return full;
  }

  formatLimit(val: number): string {
    return val === -1 ? 'Unlimited' : val.toLocaleString();
  }

  /** Next-tier teaser: "50 accounts" or "Unlimited accounts" (API uses -1 for unlimited). */
  formatMaxAccountsPhrase(max: number): string {
    if (max === -1) return 'Unlimited accounts';
    return `${max.toLocaleString()} accounts`;
  }

  getPlanBadge(plan: PlanCard): string | null {
    if (plan.badge) return plan.badge;
    return null;
  }

  getPlanBadgeClass(plan: PlanCard): string {
    if (plan.badgeColor === 'purple') {
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    }
    if (plan.badgeColor === 'blue') {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    }
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  upgradePlan(planId: string, planName: string): void {
    const plan = this.allPlans?.[planId];
    if (!plan) return;

    // Free plan — no payment needed, direct upgrade
    if (plan.price === 0 || plan.price === 'free') {
      this.upgradingPlan = planId;
      this.subscriptionService.upgradePlan(planId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            if (res.success) {
              this.notificationService.success('Plan Updated', `You are now on the ${planName} plan.`);
              this.loadLimits();
            }
            this.upgradingPlan = null;
          },
          error: (err) => {
            this.notificationService.error('Update Failed', err?.error?.error || 'Could not change plan.');
            this.upgradingPlan = null;
          }
        });
      return;
    }

    // Paid plan — open Razorpay checkout
    this.upgradingPlan = planId;
    const priceLabel = formatPlanPriceMonthly(plan.price);

    this.razorpayService.initiateUpgrade({ planId, planName, priceLabel })
      .then((res) => {
        if (res.success) {
          this.notificationService.success(
            'Payment Successful',
            `Welcome to the ${planName} plan! Your new limits are active immediately.`
          );
          this.loadLimits();
        }
        this.upgradingPlan = null;
      })
      .catch((errMsg: string) => {
        if (errMsg !== 'Payment cancelled.') {
          this.notificationService.error('Payment Failed', errMsg || 'Could not complete payment. Please try again.');
        }
        this.upgradingPlan = null;
      });
  }

  confirmCancel(): void {
    this.showCancelConfirm = true;
  }

  dismissCancel(): void {
    this.showCancelConfirm = false;
    this.cancelReason = '';
  }

  submitCancel(): void {
    this.cancellingPlan = true;
    this.subscriptionService.cancelSubscription(true, this.cancelReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.info(
              'Cancellation Scheduled',
              'Your plan will be cancelled at the end of the billing period. You can reactivate any time.'
            );
            this.loadLimits();
          }
          this.cancellingPlan = false;
          this.dismissCancel();
        },
        error: (err) => {
          this.notificationService.error(
            'Cancellation Failed',
            err?.error?.error || 'Could not cancel. Please contact support.'
          );
          this.cancellingPlan = false;
        }
      });
  }

  reactivateSubscription(): void {
    this.cancellingPlan = true;
    this.subscriptionService.reactivateSubscription()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Plan Reactivated', 'Your subscription has been reactivated.');
            this.loadLimits();
          }
          this.cancellingPlan = false;
        },
        error: (err) => {
          this.notificationService.error('Reactivation Failed', err?.error?.error || 'Could not reactivate. Please contact support.');
          this.cancellingPlan = false;
        }
      });
  }

  contactSales(): void {
    this.notificationService.info(
      'Contact Sales',
      'Email us at sales@repmeup.com for Enterprise pricing and custom solutions.'
    );
  }

  // ─── Billing Helpers ────────────────────────────────────────────────────────

  get billing() {
    return this.subscriptionLimits?.billing ?? null;
  }

  formatDate(d: string | null | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
