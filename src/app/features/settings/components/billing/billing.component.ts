import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SubscriptionService,
  ISubscriptionLimits,
  IPlanMeter,
  IAddOnOffer,
  IMyRecurringAddOn,
  IWhatsAppSpend,
  IPlanTier
} from '../../../../core/services/subscription.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { RazorpayService } from '../../../../core/services/razorpay.service';
import { PlanIntentService } from '../../../../core/services/plan-intent.service';
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
    private planIntent: PlanIntentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadLimits();
    this.loadPlans();
    this.loadAddOns();
    this.loadMyAddOns();
    this.loadWhatsAppSpend();

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
            // Needs the loaded plans to resolve the name, price and current-plan check.
            this.applyPlanIntent();
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

  // ── Pricing-sheet meters ────────────────────────────────────────────────
  // These come from the backend already resolved and formatted (live counts,
  // purchased top-ups, percentages) — this component only picks them out.

  get planMeters(): IPlanMeter[] {
    const m = this.subscriptionLimits?.meters;
    if (!m) return [];
    return [m.aiConversations, m.activeContacts].filter((x): x is IPlanMeter => !!x);
  }

  /** Contacts dropped this month because the org was at its Active Contacts ceiling. */
  get contactsNotSaved(): number {
    return this.subscriptionLimits?.meters?.contactsNotSaved || 0;
  }

  // ── WhatsApp pass-through spend ─────────────────────────────────────────
  // Meta's conversation charges. Identical on every plan, so this sits apart from
  // the plan meters — it's a cost, not an allowance.
  whatsappSpend: IWhatsAppSpend | null = null;

  private loadWhatsAppSpend(): void {
    this.subscriptionService.getWhatsAppSpend()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.whatsappSpend = res?.success ? (res.data ?? null) : null; },
        error: () => { this.whatsappSpend = null; }
      });
  }

  // ── Add-ons ("Boost your plan") ─────────────────────────────────────────
  addOns: IAddOnOffer[] = [];
  addOnQuantity: Record<string, number> = {};
  purchasingAddOnId: string | null = null;

  private loadAddOns(): void {
    this.subscriptionService.getAvailableAddOns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.addOns = res?.success && res.data ? res.data.items : [];
          for (const a of this.addOns) {
            this.addOnQuantity[a.addOnId] = a.minQuantity || 1;
          }
        },
        error: () => { this.addOns = []; }
      });
  }

  changeAddOnQuantity(addOn: IAddOnOffer, delta: number): void {
    const current = this.addOnQuantity[addOn.addOnId] || addOn.minQuantity || 1;
    const next = Math.min(addOn.maxQuantity || 1, Math.max(addOn.minQuantity || 1, current + delta));
    this.addOnQuantity[addOn.addOnId] = next;
  }

  /** Total for the chosen quantity — the only arithmetic here, and it's presentational. */
  addOnTotalDisplay(addOn: IAddOnOffer): string {
    const qty = this.addOnQuantity[addOn.addOnId] || 1;
    const rupees = Math.round((addOn.priceInr * qty) / 100);
    return `₹${rupees.toLocaleString('en-IN')}`;
  }

  /**
   * Buy an add-on. One-time SKUs go through Razorpay Orders, recurring ones create
   * their own subscription — the SKU's `kind` decides, so the tile is identical.
   */
  async purchaseAddOn(addOn: IAddOnOffer): Promise<void> {
    if (!addOn.purchasable || this.purchasingAddOnId) return;
    this.purchasingAddOnId = addOn.addOnId;
    const checkout = {
      addOnId: addOn.addOnId,
      name: addOn.name,
      quantity: this.addOnQuantity[addOn.addOnId] || 1,
      description: addOn.offerDisplay
    };
    try {
      if (addOn.kind === 'recurring') {
        await this.razorpayService.subscribeAddOn(checkout);
        this.notificationService.success(
          'Add-on active',
          `${addOn.name} is now active and will renew monthly.`
        );
      } else {
        await this.razorpayService.purchaseAddOn(checkout);
        this.notificationService.success('Add-on applied', `${addOn.name} is now active on your plan.`);
      }
      this.loadLimits();     // refresh the meters so the new capacity shows immediately
      this.loadAddOns();
      this.loadMyAddOns();
    } catch (err: any) {
      const message = typeof err === 'string' ? err : (err?.message || 'Purchase failed.');
      if (message !== 'Payment cancelled.') this.notificationService.error('Purchase failed', message);
    } finally {
      this.purchasingAddOnId = null;
    }
  }

  // ── Active recurring add-ons ────────────────────────────────────────────
  myRecurringAddOns: IMyRecurringAddOn[] = [];
  cancellingAddOnId: string | null = null;

  private loadMyAddOns(): void {
    this.subscriptionService.getMyAddOns()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.myRecurringAddOns = res?.success && res.data ? res.data.recurring : [];
        },
        error: () => { this.myRecurringAddOns = []; }
      });
  }

  /** Display name for an owned add-on — falls back to the id if the SKU isn't on offer. */
  addOnName(addOnId: string): string {
    return this.addOns.find((a) => a.addOnId === addOnId)?.name || addOnId;
  }

  async cancelAddOn(addOn: IMyRecurringAddOn): Promise<void> {
    if (this.cancellingAddOnId) return;
    const name = this.addOnName(addOn.addOnId);
    const confirmed = confirm(
      `Cancel ${name}?\n\nYou'll keep it until the end of the period you've already paid for.`
    );
    if (!confirmed) return;

    this.cancellingAddOnId = addOn.addOnId;
    this.subscriptionService.cancelAddOnSubscription(addOn.addOnId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.success) {
            this.notificationService.success(
              'Add-on cancelled',
              `${name} will stop renewing. You keep it until the current period ends.`
            );
            this.loadMyAddOns();
            this.loadAddOns();
          } else {
            this.notificationService.error('Could not cancel', res?.error || 'Please try again.');
          }
          this.cancellingAddOnId = null;
        },
        error: (err) => {
          this.notificationService.error(
            'Could not cancel',
            err?.error?.error || 'Please try again.'
          );
          this.cancellingAddOnId = null;
        }
      });
  }

  scrollToPlans(): void {
    document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  meterBarClass(meter: IPlanMeter): string {
    if (meter.isExhausted) return 'bg-red-500';
    if (meter.percentUsed >= 90) return 'bg-amber-500';
    return 'bg-rep-lime';
  }

  /** "10,000 + 3,000 purchased" when a top-up is active, otherwise null. */
  meterAllowanceNote(meter: IPlanMeter): string | null {
    if (!meter.purchasedDelta) return null;
    return `${meter.baseLimit.toLocaleString('en-IN')} plan `
      + `+ ${meter.purchasedDelta.toLocaleString('en-IN')} purchased`;
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
    // For AI credits, use the effective limit (plan + carried) when available
    // so the progress bar and denominator reflect the real available pool.
    if (key === 'maxAICreditsPerMonth' && this.subscriptionLimits?.creditSummary) {
      const s = this.subscriptionLimits.creditSummary;
      if (!s.isUnlimited) return s.effectiveLimit;
    }
    const val = this.subscriptionLimits?.limits[key] as number;
    return val === -1 ? '∞' : val;
  }

  hasCreditCarryForward(): boolean {
    const s = this.subscriptionLimits?.creditSummary;
    return !!(s && !s.isUnlimited && s.carriedCredits > 0);
  }

  getCreditCarryNote(): string {
    const s = this.subscriptionLimits?.creditSummary;
    if (!s || s.isUnlimited || s.carriedCredits <= 0) return '';
    return `${s.planLimit.toLocaleString()} plan + ${s.carriedCredits.toLocaleString()} carried`;
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

  // ── Billing cycle choice ────────────────────────────────────────────────
  /** Which leg the plan cards price and purchase. */
  billingCycle: 'monthly' | 'yearly' = 'monthly';

  /**
   * The plan this customer picked on the public pricing page before signing up.
   *
   * Deliberately surfaced as a banner they must click, rather than auto-opening
   * Razorpay: a payment sheet appearing unprompted on page load is startling, and the
   * customer may well have changed their mind during sign-up.
   */
  pendingPlanIntent: { planId: string; planName: string; priceLabel: string } | null = null;

  private applyPlanIntent(): void {
    const intent = this.planIntent.peek();
    if (!intent || !this.allPlans) return;

    const plan = this.allPlans[intent.planId];
    // Plan retired or renamed since they chose it — drop the stale intent silently.
    if (!plan || this.isCurrentPlan(intent.planId)) {
      this.planIntent.clear();
      return;
    }

    this.billingCycle = intent.billingCycle === 'yearly' && plan.pricing?.annual
      ? 'yearly'
      : 'monthly';
    this.pendingPlanIntent = {
      planId: intent.planId,
      planName: plan.name ?? intent.planId,
      priceLabel: this.planPrice(intent.planId).display
    };
  }

  resumePlanIntent(): void {
    const intent = this.pendingPlanIntent;
    if (!intent) return;
    this.planIntent.clear();
    this.pendingPlanIntent = null;
    this.upgradePlan(intent.planId, intent.planName);
  }

  dismissPlanIntent(): void {
    this.planIntent.clear();
    this.pendingPlanIntent = null;
  }

  /** True when at least one plan publishes an annual price — hides the toggle otherwise. */
  get hasAnnualOption(): boolean {
    return Object.values(this.allPlans || {}).some((p) => !!p.pricing?.annual);
  }

  setBillingCycle(cycle: 'monthly' | 'yearly'): void {
    this.billingCycle = cycle;
  }

  /** The price block to show for a plan at the current cycle, backend-formatted. */
  planPrice(planKey: string): { display: string; suffix: string | null; note: string | null } {
    const pricing = this.getPlan(planKey)?.pricing;
    const annual = pricing?.annual;
    if (this.billingCycle === 'yearly' && annual) {
      return {
        display: annual.display,
        suffix: annual.suffix,
        note: annual.savingsLabel || annual.perMonthEquivalentDisplay
      };
    }
    // Monthly, or a plan with no annual option — falls back so a mixed lineup still renders.
    return {
      display: pricing?.monthly?.display ?? formatPlanPriceMonthly(this.getPlan(planKey)?.price),
      suffix: pricing?.monthly?.suffix ?? null,
      note: null
    };
  }

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

    // Paid plan — open Razorpay checkout on the leg the customer is looking at.
    // A plan without an annual price always falls back to monthly, so the toggle can
    // never send someone to a billing leg that does not exist.
    this.upgradingPlan = planId;
    const wantsAnnual = this.billingCycle === 'yearly' && !!plan.pricing?.annual;
    const billingCycle: 'monthly' | 'yearly' = wantsAnnual ? 'yearly' : 'monthly';
    const priceLabel = this.planPrice(planId).display;

    this.razorpayService.initiateUpgrade({ planId, planName, priceLabel, billingCycle })
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
