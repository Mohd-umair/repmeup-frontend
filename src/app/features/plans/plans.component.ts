import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SubscriptionService, IPlanTier } from '../../core/services/subscription.service';
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
export class PlansComponent implements OnInit {
  allPlans: Record<string, IPlanTier> | null = null;
  subscriptionLimits: import('../../core/services/subscription.service').ISubscriptionLimits | null = null;
  loadingPlans = false;
  loadingSubscription = false;
  upgradingPlan = false;

  constructor(
    private subscriptionService: SubscriptionService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscriptionLimits();
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
    if (!confirm(`Upgrade to ${planName} plan?\n\nThis will immediately update your account limits and billing.`)) {
      return;
    }

    this.upgradingPlan = true;
    this.subscriptionService.upgradePlan(planId).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Plan Upgraded Successfully!',
            `You're now on the ${planName} plan. Your new limits are active immediately.`
          );
          this.loadSubscriptionLimits();
        }
        this.upgradingPlan = false;
      },
      error: (error) => {
        const errorMessage = error.error?.error || error.error?.message || 'Failed to upgrade plan';
        this.notificationService.error('Upgrade Failed', errorMessage);
        this.upgradingPlan = false;
      }
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
