import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ops-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-40 bg-black/40" (click)="close.emit()" aria-hidden="true"></div>
      <aside
        class="fixed top-0 right-0 z-50 h-full w-full max-w-lg flex flex-col shadow-2xl border-l"
        style="background-color: var(--surface-primary); border-color: var(--card-border);"
        role="dialog"
        [attr.aria-label]="title"
      >
        <div class="flex items-start justify-between gap-3 p-4 border-b" style="border-color: var(--card-border);">
          <div class="min-w-0">
            <h2 class="text-lg font-bold truncate" style="color: var(--text-primary);">{{ title }}</h2>
            @if (subtitle) {
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">{{ subtitle }}</p>
            }
          </div>
          <button
            type="button"
            (click)="close.emit()"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            <i class="fas fa-times" style="color: var(--text-secondary);"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <ng-content></ng-content>
        </div>
        @if (showFooter) {
          <div class="p-4 border-t flex flex-wrap gap-2 justify-end" style="border-color: var(--card-border);">
            <ng-content select="[drawerFooter]"></ng-content>
          </div>
        }
      </aside>
    }
  `
})
export class OpsDetailDrawerComponent {
  @Input() open = false;
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() showFooter = true;
  @Output() close = new EventEmitter<void>();
}
