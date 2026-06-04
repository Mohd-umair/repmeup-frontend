import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SubscriptionService, IPlanTier } from '../../core/services/subscription.service';
import { RazorpayService } from '../../core/services/razorpay.service';
import { formatPlanPriceMonthly } from '../../core/utils/plan-price-format';
import {
  IPlanCardData,
  resolvePlanFeatures,
  resolvePlanHighlights,
  sortPlanKeys
} from '../../core/utils/plan-presentation.util';
import { NotificationService } from '../../core/services/notification.service';
import { PlanHighlightsListComponent } from '../../shared/components/plan-highlights-list/plan-highlights-list.component';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, RouterModule, PlanHighlightsListComponent],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.scss']
})
export class PlansComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allPlans: Record<string, IPlanTier> | null = null;
  subscriptionLimits: import('../../core/services/subscription.service').ISubscriptionLimits | null = null;
  loadingPlans = false;
  loadingSubscription = false;
  /** Plan id currently being upgraded, or null. */
  upgradingPlan: string | null = null;

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private razorpayService: RazorpayService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscriptionLimits();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPlans(): void {
    this.loadingPlans = true;
    this.subscriptionService.getPlans().subscribe({
      next: (response) => {
        if (response.success) {
          this.allPlans = response.data;
        }
        this.loadingPlans = false;
      },
      error: () => {
        this.notificationService.error(
          'Failed to Load Plans',
          'Could not load subscription plans. Please try again.'
        );
        this.loadingPlans = false;
      }
    });
  }

  loadSubscriptionLimits(): void {
    this.loadingSubscription = true;
    this.subscriptionService.getLimits().subscribe({
      next: (response) => {
        if (response.success) {
          this.subscriptionLimits = response.data;
        }
        this.loadingSubscription = false;
      },
      error: () => {
        this.loadingSubscription = false;
      }
    });
  }

  getPlanKeys(): string[] {
    return sortPlanKeys(this.allPlans as Record<string, IPlanCardData> | null);
  }

  getPlan(planId: string): IPlanTier {
    return this.allPlans![planId];
  }

  planHighlights(planId: string) {
    return resolvePlanHighlights(this.getPlan(planId) as IPlanCardData);
  }

  planFeatures(planId: string) {
    return resolvePlanFeatures(this.getPlan(planId) as IPlanCardData);
  }

  formatPrice(price: number | string): string {
    return formatPlanPriceMonthly(price);
  }

  isCurrentPlan(planId: string): boolean {
    return this.subscriptionLimits?.planId === planId;
  }

  canUpgradeToPlan(planTier: number): boolean {
    if (!this.subscriptionLimits) return false;
    return planTier > this.subscriptionLimits.tier;
  }

  upgradeToPlan(planId: string, planName: string): void {
    const plan = this.allPlans?.[planId];
    if (!plan) return;

    // Free plan — no payment, direct upgrade
    if (plan.price === 0 || plan.price === 'free') {
      if (!confirm(`Switch to ${planName} plan?\n\nThis will immediately update your account limits.`)) {
        return;
      }

      this.upgradingPlan = planId;
      this.subscriptionService.upgradePlan(planId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.notificationService.success(
                'Plan Updated!',
                `You are now on the ${planName} plan. Your new limits are active immediately.`
              );
              this.loadSubscriptionLimits();
            }
            this.upgradingPlan = null;
          },
          error: (error) => {
            const errorMessage = error.error?.error || error.error?.message || 'Failed to upgrade plan';
            this.notificationService.error('Upgrade Failed', errorMessage);
            this.upgradingPlan = null;
          }
        });
      return;
    }

    // Paid plan — Razorpay checkout
    this.upgradingPlan = planId;
    const priceLabel = formatPlanPriceMonthly(plan.price);

    this.razorpayService.initiateUpgrade({ planId, planName, priceLabel })
      .then((res) => {
        if (res.success) {
          this.notificationService.success(
            'Payment Successful',
            `Welcome to the ${planName} plan! Your new limits are active immediately.`
          );
          this.loadSubscriptionLimits();
        }
        this.upgradingPlan = null;
      })
      .catch((errMsg: string) => {
        if (errMsg !== 'Payment cancelled.') {
          this.notificationService.error(
            'Payment Failed',
            errMsg || 'Could not complete payment. Please try again.'
          );
        }
        this.upgradingPlan = null;
      });
  }

  contactSales(): void {
    this.notificationService.info(
      'Contact Sales',
      'Please email sales@repmeup.com for Enterprise pricing and custom solutions.'
    );
  }

  goToSettings(): void {
    this.router.navigate(['/app/settings/accounts']);
  }

  getPlanBadge(plan: IPlanTier): string | null {
    if (plan.badge) return plan.badge.toUpperCase();
    if (plan.tier === 2) return 'MOST POPULAR';
    return null;
  }

  getPlanBadgeColor(plan: IPlanTier): string {
    if (plan.badgeColor === 'purple') return 'bg-purple-600';
    if (plan.badgeColor === 'blue') return 'bg-blue-600';
    return 'bg-blue-600';
  }
}
