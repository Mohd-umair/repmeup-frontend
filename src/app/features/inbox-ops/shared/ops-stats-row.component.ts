import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IOpsStatCard } from '../../../core/models/inbox-ops.model';

@Component({
  selector: 'app-ops-stats-row',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      @for (card of cards; track card.label) {
        <div
          class="rounded-xl border p-4 shadow-sm"
          [ngClass]="toneClass(card.tone)"
          style="border-color: var(--card-border); background-color: var(--surface-primary);"
        >
          <p class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--text-secondary);">
            {{ card.label }}
          </p>
          <p class="text-2xl font-bold" style="color: var(--text-primary);">{{ card.value }}</p>
          @if (card.sub) {
            <p class="text-xs mt-1" style="color: var(--text-muted);">{{ card.sub }}</p>
          }
        </div>
      }
    </div>
  `
})
export class OpsStatsRowComponent {
  @Input({ required: true }) cards: IOpsStatCard[] = [];

  toneClass(tone?: IOpsStatCard['tone']): string {
    switch (tone) {
      case 'lime':
        return 'ring-1 ring-rep-lime/30';
      case 'green':
        return 'ring-1 ring-emerald-500/20';
      case 'amber':
        return 'ring-1 ring-amber-500/20';
      case 'red':
        return 'ring-1 ring-red-500/20';
      case 'blue':
        return 'ring-1 ring-sky-500/20';
      default:
        return '';
    }
  }
}
