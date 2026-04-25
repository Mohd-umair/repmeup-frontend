import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SubscriptionService, ISubscriptionLimits } from '../../core/services/subscription.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './plans.component.html',
  styleUrls: ['./plans.component.scss']
})
export class PlansComponent implements OnInit {
  allPlans: any = null;
  subscriptionLimits: ISubscriptionLimits | null = null;
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

  /**
   * Load all available plans
   */
  loadPlans(): void {
    this.loadingPlans = true;
    this.subscriptionService.getPlans().subscribe({
      next: (response) => {
        if (response.success) {
          this.allPlans = response.data;
        }
        this.loadingPlans = false;
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.notificationService.error(
          'Failed to Load Plans',
          'Could not load subscription plans. Please try again.'
        );
        this.loadingPlans = false;
      }
    });
  }

  /**
   * Load current subscription limits
   */
  loadSubscriptionLimits(): void {
    this.loadingSubscription = true;
    this.subscriptionService.getLimits().subscribe({
      next: (response) => {
        if (response.success) {
          this.subscriptionLimits = response.data;
        }
        this.loadingSubscription = false;
      },
      error: (error) => {
        console.error('Error loading subscription:', error);
        this.loadingSubscription = false;
      }
    });
  }

  /**
   * Get plan keys as array
   */
  getPlanKeys(): string[] {
    if (!this.allPlans) return [];
    return Object.keys(this.allPlans);
  }

  /**
   * Format price display
   */
  formatPrice(price: number | string): string {
    if (price === 'custom') return 'Contact Sales';
    if (typeof price === 'number') {
      if (price === 0) return 'Free';
      return `$${price}/mo`;
    }
    return price;
  }

  /**
   * Format feature name
   */
  formatFeatureName(feature: string): string {
    return feature
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Check if plan is current
   */
  isCurrentPlan(planId: string): boolean {
    return this.subscriptionLimits?.planId === planId;
  }

  /**
   * Check if can upgrade to plan
   */
  canUpgradeToPlan(planTier: number): boolean {
    if (!this.subscriptionLimits) return false;
    return planTier > this.subscriptionLimits.tier;
  }

  /**
   * Upgrade to specific plan
   */
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
          
          // Refresh subscription limits
          this.loadSubscriptionLimits();
        }
        this.upgradingPlan = false;
      },
      error: (error) => {
        console.error('Error upgrading plan:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to upgrade plan';
        this.notificationService.error(
          'Upgrade Failed',
          errorMessage
        );
        this.upgradingPlan = false;
      }
    });
  }

  /**
   * Contact sales for custom plan
   */
  contactSales(): void {
    this.notificationService.info(
      'Contact Sales',
      'Please email sales@repmeup.com for Enterprise pricing and custom solutions.'
    );
  }

  /**
   * Navigate back to settings
   */
  goToSettings(): void {
    this.router.navigate(['/app/settings']);
  }

  /**
   * Get plan recommendation badge
   */
  getPlanBadge(planId: string): string | null {
    if (planId === 'pro') return 'MOST POPULAR';
    if (planId === 'business') return 'BEST VALUE';
    return null;
  }

  /**
   * Get plan badge color
   */
  getPlanBadgeColor(planId: string): string {
    if (planId === 'pro') return 'bg-blue-600';
    if (planId === 'business') return 'bg-purple-600';
    return 'bg-gray-600';
  }
}
