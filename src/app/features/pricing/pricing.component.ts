import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PricingService } from '../../core/services/pricing.service';
import { PlanIntentService } from '../../core/services/plan-intent.service';
import {
  PricingPageData,
  PricingPlanCard,
  BillingCycleChoice
} from '../../core/models/pricing.model';

@Component({
  selector: 'app-pricing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.scss']
})
export class PricingComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly data = signal<PricingPageData | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly cycle = signal<BillingCycleChoice>('monthly');

  /** True when at least one plan publishes an annual price — hides the toggle otherwise. */
  readonly hasAnnualOption = computed(() =>
    (this.data()?.plans || []).some((p) => !!p.pricing.annual)
  );

  constructor(
    private pricing: PricingService,
    private planIntent: PlanIntentService
  ) {}

  /**
   * Carry the chosen plan and cycle through sign-up.
   *
   * The query params are for the register page; the stored copy is what actually
   * survives, because registration routes through email verification and the customer
   * comes back via a fresh link with no state.
   */
  rememberChoice(plan: PricingPlanCard): void {
    const cycle = this.cycle() === 'annual' && plan.pricing.annual ? 'yearly' : 'monthly';
    this.planIntent.remember(plan.planId, cycle);
  }

  ngOnInit(): void {
    this.pricing.getPricingPage()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (!res?.success || !res.data) {
            this.error.set(res?.error || 'Could not load pricing right now.');
            return;
          }
          this.data.set(res.data);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Could not load pricing right now. Please try again.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setCycle(next: BillingCycleChoice): void {
    this.cycle.set(next);
  }

  /**
   * The price block to show for a plan at the current cycle. Falls back to monthly
   * when a plan has no annual option, so a mixed lineup still renders sensibly.
   */
  priceFor(plan: PricingPlanCard): {
    display: string;
    suffix: string | null;
    strikeThrough: string | null;
    savingsLabel: string | null;
    perMonthEquivalentDisplay: string | null;
  } {
    const annual = plan.pricing.annual;
    if (this.cycle() === 'annual' && annual) {
      return {
        display: annual.display,
        suffix: annual.suffix,
        strikeThrough: annual.strikeThrough,
        savingsLabel: annual.savingsLabel,
        perMonthEquivalentDisplay: annual.perMonthEquivalentDisplay
      };
    }
    const monthly = plan.pricing.monthly;
    return {
      display: monthly.display,
      suffix: monthly.suffix,
      strikeThrough: null,
      savingsLabel: null,
      perMonthEquivalentDisplay: null
    };
  }

  isDark(plan: PricingPlanCard): boolean {
    return plan.cardStyle === 'dark';
  }

  trackByPlanId(_: number, plan: PricingPlanCard): string {
    return plan.planId;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
