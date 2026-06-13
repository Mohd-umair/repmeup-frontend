import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AutoReplySettings } from '../../../core/services/organization.service';

export interface SetupStep {
  id: string;
  label: string;
  description: string;
  /** Font Awesome classes when useAiBrandIcon is false */
  icon: string;
  /** Brand AI mark (same as home) instead of font icon */
  useAiBrandIcon?: boolean;
  done: boolean;
  link?: string;
  linkLabel?: string;
}

import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

@Component({
  selector: 'app-inbox-setup-guide',
  standalone: true,
  imports: [CommonModule, RouterModule, AiChatBubbleIconComponent],
  templateUrl: './inbox-setup-guide.component.html'
})
export class InboxSetupGuideComponent implements OnChanges {
  @Input() autoReplySettings: AutoReplySettings | null = null;
  @Input() hasKnowledgeBase = false;
  @Input() hasConnectedPlatform = false;
  @Input() orgId: string | null = null;
  /** Emitted when permanently dismissed (localStorage flag set) */
  @Output() dismissed = new EventEmitter<void>();

  /** Temporarily hidden for this session only (no localStorage) */
  manuallyDismissed = false;
  steps: SetupStep[] = [];

  /** 24 hours in milliseconds — snooze duration for "Got it, set up later". */
  private static readonly SNOOZE_MS = 24 * 60 * 60 * 1000;

  private get storageKey(): string {
    return `setup_guide_dismissed_${this.orgId ?? 'default'}`;
  }

  private get snoozeKey(): string {
    return `setup_guide_snoozed_until_${this.orgId ?? 'default'}`;
  }

  get isPermanentlyDismissed(): boolean {
    try { return localStorage.getItem(this.storageKey) === '1'; } catch { return false; }
  }

  /** True when the user clicked "Got it, set up later" within the last 24 hours. */
  get isSnoozed(): boolean {
    try {
      const until = Number(localStorage.getItem(this.snoozeKey) || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch { return false; }
  }

  get shouldShow(): boolean {
    if (this.isPermanentlyDismissed) return false;
    if (this.isSnoozed) return false;
    return !this.hasConnectedPlatform || !this.autoReplySettings?.enabled || !this.hasKnowledgeBase;
  }

  get completedCount(): number {
    return this.steps.filter(s => s.done).length;
  }

  get progressPercent(): number {
    return this.steps.length ? Math.round((this.completedCount / this.steps.length) * 100) : 0;
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.buildSteps();
  }

  /**
   * Close for 24 hours. Setting a snooze-until timestamp in localStorage so the
   * modal doesn't bounce back every time the user navigates back to the inbox.
   * Setup progress is still re-checked on navigation — if the user completes all
   * steps, `shouldShow` will return false regardless of snooze.
   */
  dismiss(): void {
    try {
      localStorage.setItem(this.snoozeKey, String(Date.now() + InboxSetupGuideComponent.SNOOZE_MS));
    } catch { /* storage unavailable — fall back to session-only */ }
    this.manuallyDismissed = true;
  }

  /** Permanently hide via localStorage */
  dismissPermanently(): void {
    try { localStorage.setItem(this.storageKey, '1'); } catch { /* storage unavailable */ }
    this.manuallyDismissed = true;
    this.dismissed.emit();
  }

  private buildSteps(): void {
    const ar = this.autoReplySettings;
    this.steps = [
      {
        id: 'platform',
        label: 'Connect at least one platform',
        description: 'Link a social platform (Instagram, Facebook, YouTube, Google…) so customer messages flow into your inbox.',
        icon: 'fas fa-plug',
        done: this.hasConnectedPlatform,
        link: '/app/settings/platforms',
        linkLabel: 'Connect now'
      },
      {
        id: 'kb',
        label: 'Add knowledge base entries',
        description: 'Teach the AI about your business — FAQs, products, policies — so it replies accurately.',
        icon: 'fas fa-book-open',
        done: this.hasKnowledgeBase,
        link: '/app/knowledge-base',
        linkLabel: 'Open KB'
      },
      {
        id: 'autoreply',
        label: 'Enable Auto Reply',
        description: 'Turn on Reppy-powered replies so every customer message gets an instant, personalised response.',
        icon: '',
        useAiBrandIcon: true,
        done: !!ar?.enabled,
        link: '/app/automation/ai-replies',
        linkLabel: 'Enable'
      },
      {
        id: 'fallback',
        label: 'Set a fallback message',
        description: "A friendly reply for when Reppy isn't confident, so no customer is left unanswered.",
        icon: 'fas fa-life-ring',
        done: !!(ar?.fallbackSettings?.enabled && ar?.fallbackSettings?.message),
        link: '/app/automation/ai-replies',
        linkLabel: 'Configure'
      }
    ];
  }
}
