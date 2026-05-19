import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-automation-page-shell',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex-1 overflow-auto p-4 sm:p-6 space-y-5" style="background-color: var(--bg-primary);">

      <!-- Breadcrumb + header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div class="flex items-center gap-1.5 text-xs mb-1" style="color: var(--text-muted);">
            <a routerLink="/app/automation" style="color: var(--text-muted);"
               class="hover:underline transition-colors">Automation Hub</a>
            <i class="fas fa-chevron-right text-[9px]"></i>
            <span style="color: var(--text-primary);">{{ title }}</span>
          </div>
          <h1 class="text-2xl font-bold flex items-center gap-2" style="color: var(--text-primary);">
            {{ title }}
          </h1>
          <p class="text-sm mt-0.5" style="color: var(--text-secondary);" *ngIf="subtitle">{{ subtitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <ng-content select="[slot=actions]"></ng-content>
        </div>
      </div>

      <!-- Main content -->
      <ng-content></ng-content>

    </div>

    <!-- Right rail rendered as a sticky aside when hasRail is true -->
    <ng-container *ngIf="hasRail">
      <div class="hidden lg:flex flex-col w-80 flex-shrink-0 border-l overflow-y-auto p-5 gap-5"
           style="border-color: var(--card-border); background-color: var(--card-bg);">
        <ng-content select="[slot=rail]"></ng-content>
      </div>
    </ng-container>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    :host > div:first-child {
      flex: 1;
      min-width: 0;
    }
  `]
})
export class AutomationPageShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() hasRail = false;
}
