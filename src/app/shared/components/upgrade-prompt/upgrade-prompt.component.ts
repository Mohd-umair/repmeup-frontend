import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EntitlementsStore, FeatureKey } from '../../../core/services/entitlements.store';

@Component({
  selector: 'app-upgrade-prompt',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div
      class="rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="status"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">{{ title }}</p>
        <p class="text-xs text-amber-800/90 dark:text-amber-200/80 mt-0.5">{{ message }}</p>
        @if (ent.planSummary(); as plan) {
          <p class="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-1">
            Current plan: {{ plan.planName }}
          </p>
        }
      </div>
      <a
        routerLink="/app/plans"
        [queryParams]="featureKey ? { upgrade: featureKey } : null"
        class="shrink-0 inline-flex items-center justify-center rounded-lg bg-rep-lime text-rep-black text-xs font-semibold px-3 py-2 hover:bg-rep-lime/90 transition"
      >
        Upgrade plan
      </a>
    </div>
  `
})
export class UpgradePromptComponent {
  readonly ent = inject(EntitlementsStore);

  @Input() title = 'This feature is not on your plan';
  @Input() message = 'Upgrade to unlock this capability for your organization.';
  @Input() featureKey?: FeatureKey;
}
