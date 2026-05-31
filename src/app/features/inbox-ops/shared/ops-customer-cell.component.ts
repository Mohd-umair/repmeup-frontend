import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ops-customer-cell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 min-w-0">
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-rep-lime/20 text-rep-black dark:text-rep-lime"
      >
        {{ initial }}
      </div>
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate" style="color: var(--text-primary);">{{ name }}</p>
        <p class="text-xs truncate" style="color: var(--text-muted);">{{ handle || '—' }}</p>
      </div>
    </div>
  `
})
export class OpsCustomerCellComponent {
  @Input({ required: true }) name = '';
  @Input() handle = '';

  get initial(): string {
    return (this.name || '?').charAt(0).toUpperCase();
  }
}
