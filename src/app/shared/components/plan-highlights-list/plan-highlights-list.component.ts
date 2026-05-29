import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IPlanFeatureBullet,
  IPlanHighlight,
  planHighlightIcon
} from '../../../core/utils/plan-presentation.util';
import { AiChatBubbleIconComponent } from '../ai-chat-bubble-icon/ai-chat-bubble-icon.component';

@Component({
  selector: 'app-plan-highlights-list',
  standalone: true,
  imports: [CommonModule, AiChatBubbleIconComponent],
  template: `
    @if (highlights.length) {
      <div [class]="compact ? 'space-y-2' : 'space-y-3'">
        @for (row of visibleHighlights; track row.key) {
          <div class="flex items-center gap-3">
            <div
              class="flex-shrink-0 rounded-lg flex items-center justify-center"
              [class]="compact ? 'w-8 h-8' : 'w-10 h-10'"
              [ngClass]="iconBgClass(row.key)">
              @if (isAiIcon(row.key)) {
                <app-ai-chat-bubble-icon [iconClass]="compact ? 'w-4 h-4' : 'w-5 h-5'"></app-ai-chat-bubble-icon>
              } @else {
                <i [class]="planHighlightIcon(row.key) + ' ' + (compact ? 'text-sm' : 'text-base')" [ngClass]="iconColorClass(row.key)"></i>
              }
            </div>
            <div class="min-w-0">
              <p class="font-bold text-rep-black dark:text-white leading-tight" [class.text-sm]="compact">
                {{ row.value }}
              </p>
              <p class="text-gray-600 dark:text-gray-400" [class.text-xs]="compact" [class.text-sm]="!compact">
                {{ row.label }}
              </p>
            </div>
          </div>
        }
      </div>
    }

    @if (features.length) {
      <div [class.mt-4]="highlights.length" [class.mt-0]="!highlights.length">
        @if (showFeaturesHeading) {
          <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Included modules
          </p>
        }
        <div [class]="compact ? 'space-y-1.5' : 'space-y-2'">
          @for (feat of visibleFeatures; track feat.key) {
            <div class="flex items-start gap-2">
              <i class="fas fa-check text-green-500 mt-0.5 flex-shrink-0 text-xs"></i>
              <span class="text-gray-700 dark:text-gray-200" [class.text-xs]="compact" [class.text-sm]="!compact">
                {{ feat.label }}
              </span>
            </div>
          }
          @if (features.length > visibleFeatures.length) {
            <p class="text-xs text-gray-500 dark:text-gray-400 pl-5">
              +{{ features.length - visibleFeatures.length }} more
            </p>
          }
        </div>
      </div>
    }
  `
})
export class PlanHighlightsListComponent {
  readonly planHighlightIcon = planHighlightIcon;

  @Input() highlights: IPlanHighlight[] = [];
  @Input() features: IPlanFeatureBullet[] = [];
  @Input() compact = false;
  @Input() maxHighlights = 6;
  @Input() maxFeatures = 8;
  @Input() showFeaturesHeading = true;

  get visibleHighlights(): IPlanHighlight[] {
    return this.highlights.slice(0, this.maxHighlights);
  }

  get visibleFeatures(): IPlanFeatureBullet[] {
    return this.features.slice(0, this.maxFeatures);
  }

  isAiIcon(key: string): boolean {
    return key.includes('credits.') || key.includes('ai.');
  }

  iconBgClass(key: string): string {
    if (key.includes('accounts')) return 'bg-blue-100 dark:bg-blue-900/30';
    if (key.includes('users')) return 'bg-green-100 dark:bg-green-900/30';
    if (key.includes('posts')) return 'bg-purple-100 dark:bg-purple-900/30';
    if (key.includes('campaign')) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (key.includes('commerce') || key.includes('product')) return 'bg-amber-100 dark:bg-amber-900/30';
    return 'bg-gray-100 dark:bg-gray-800';
  }

  iconColorClass(key: string): string {
    if (key.includes('accounts')) return 'text-blue-600 dark:text-blue-400';
    if (key.includes('users')) return 'text-green-600 dark:text-green-400';
    if (key.includes('posts')) return 'text-purple-600 dark:text-purple-400';
    if (key.includes('campaign')) return 'text-emerald-600 dark:text-emerald-400';
    if (key.includes('commerce') || key.includes('product')) return 'text-amber-600 dark:text-amber-400';
    return 'text-gray-600 dark:text-gray-400';
  }
}
