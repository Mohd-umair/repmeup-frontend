import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EntitlementsStore, FeatureKey } from '../../../core/services/entitlements.store';

/** Compact used/limit meter for monthly entitlement buckets. */
@Component({
  selector: 'app-usage-meter',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (label) {
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-3 py-2">
        <div class="flex items-center justify-between gap-2 text-xs mb-1.5">
          <span class="font-medium text-gray-700 dark:text-gray-200">{{ label }}</span>
          <span [class.text-red-600]="ent.isExhausted(featureKey)" class="text-gray-600 dark:text-gray-400">
            {{ ent.used(featureKey) }} / {{ displayLimit }}
          </span>
        </div>
        <div class="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            [class.bg-rep-lime]="!ent.isExhausted(featureKey)"
            [class.bg-red-500]="ent.isExhausted(featureKey)"
            [style.width.%]="percent"
          ></div>
        </div>
      </div>
    }
  `
})
export class UsageMeterComponent {
  readonly ent = inject(EntitlementsStore);

  @Input({ required: true }) featureKey!: FeatureKey;
  @Input() label = '';

  get displayLimit(): string {
    const lim = this.ent.limit(this.featureKey);
    return lim === -1 || lim === undefined ? '∞' : String(lim);
  }

  get percent(): number {
    const lim = this.ent.limit(this.featureKey);
    if (lim === undefined || lim === -1 || lim <= 0) return 0;
    return Math.min(100, Math.round((this.ent.used(this.featureKey) / lim) * 100));
  }
}
