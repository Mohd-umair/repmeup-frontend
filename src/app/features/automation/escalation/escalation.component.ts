import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import {
  EscalationService,
  IEscalationSettings,
  IEscalationStats
} from '../../../core/services/escalation.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';

@Component({
  selector: 'app-escalation',
  standalone: true,
  imports: [CommonModule, FormsModule, AutomationPageShellComponent, AutomationSwitchComponent],
  templateUrl: './escalation.component.html',
  styleUrls: ['./escalation.component.scss']
})
export class EscalationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'triggers' | 'routing' | 'notifications' | 'analytics' = 'triggers';

  loadingSettings = true;
  savingSettings = false;
  settingsError = '';
  loadingStats = true;
  loadingBreakdown = true;

  settings: IEscalationSettings = {
    enabled: true,
    maxAutoReplies: 3,
    escalateOnNegative: true,
    negativeThreshold: 2,
    escalationKeywords: [],
    lowConfidenceThreshold: 0.7,
    lowConfidenceCount: 2,
    assignmentMethod: 'round_robin',
    autoAssign: true,
    notifyAgents: true,
    notificationChannels: ['email'],
    handoffMessageTemplate: 'Thank you for reaching out. I\'m connecting you with a team member who can better assist you.',
    handoffMessage: 'Thank you for reaching out. I\'m connecting you with a team member who can better assist you.',
    triggers: {
      lowConfidence: true, negativeSentiment: true, complexRequests: false,
      repeatedMessages: false, keywords: [], outsideBusinessHours: false
    },
    routing: { strategy: 'round_robin', slaMinutes: 60, fallbackOption: 'queue' },
    notifications: { notifyAgents: true, notifyCustomer: true, addInternalNote: false, slaBreachAlert: true }
  };

  stats: IEscalationStats | null = null;
  topReasons: { _id: string; count: number }[] = [];

  triggerOptions: { key: string; label: string; desc: string }[] = [
    { key: 'lowConfidence',         label: 'Low AI Confidence',      desc: 'Escalate when AI confidence falls below the threshold' },
    { key: 'negativeSentiment',     label: 'Negative Sentiment',     desc: 'Escalate when the customer message is very negative' },
    { key: 'complexRequests',       label: 'Complex Requests',       desc: 'Escalate when the AI classifies the request as complex' },
    { key: 'repeatedMessages',      label: 'Repeated Messages',      desc: 'Escalate when the customer sends the same message multiple times' },
    { key: 'outsideBusinessHours',  label: 'Outside Business Hours', desc: 'Queue for human review after hours instead of Reppy replying' },
  ];

  constructor(
    private escalationService: EscalationService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings(): void {
    this.escalationService.getSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingSettings = false; }))
      .subscribe({
        next: r => {
          if (r.data) {
            this.settings = { ...this.settings, ...r.data };
            if (!this.settings.triggers) {
              this.settings.triggers = { lowConfidence: true, negativeSentiment: true, complexRequests: false, repeatedMessages: false, keywords: [], outsideBusinessHours: false };
            }
            if (!this.settings.routing) {
              this.settings.routing = { strategy: 'round_robin', slaMinutes: 60, fallbackOption: 'queue' };
            }
            if (!this.settings.notifications) {
              this.settings.notifications = { notifyAgents: true, notifyCustomer: true, addInternalNote: false, slaBreachAlert: true };
            }
          }
        },
        error: () => { this.settingsError = 'Failed to load escalation settings.'; }
      });
  }

  loadStats(): void {
    this.escalationService.getStats()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingStats = false; }))
      .subscribe({ next: r => { this.stats = this.normalizeEscalationStats(r.data); } });

    this.escalationService.getTopReasons()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loadingBreakdown = false; }))
      .subscribe({ next: r => { this.topReasons = (r.data ?? []).map((x: any) => ({ _id: x._id ?? x.label, count: x.count })); } });
  }

  saveSettings(): void {
    this.savingSettings = true;
    this.settingsError = '';
    this.escalationService.updateSettings(this.settings)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.savingSettings = false; }))
      .subscribe({
        next: () => this.notify.success('Saved', 'Escalation settings updated.'),
        error: err => {
          this.settingsError = err?.error?.error || 'Failed to save.';
          this.notify.error('Error', this.settingsError);
        }
      });
  }

  isTriggerEnabled(key: string): boolean {
    return !!(this.settings.triggers as any)?.[key];
  }

  setTrigger(key: string, enabled: boolean): void {
    if (!this.settings.triggers) return;
    (this.settings.triggers as Record<string, unknown>)[key] = enabled;
  }

  /**
   * API returns some KPIs as `{ value, change }`; template expects plain numbers.
   * Also maps `totalEscalated` → `totalEscalations` and parses `avgResponseTime` when needed.
   */
  private normalizeEscalationStats(raw: IEscalationStats | null | undefined): IEscalationStats | null {
    if (!raw) return null;
    const statNum = (v: unknown): number => {
      if (v == null) return 0;
      if (typeof v === 'number' && !Number.isNaN(v)) return v;
      if (typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'number') {
        return Number((v as { value: number }).value) || 0;
      }
      return 0;
    };

    const totalEscalations = statNum(raw.totalEscalated ?? raw.totalEscalations);
    const resolved = statNum(raw.resolved);

    let avgResolutionMinutes = typeof raw.avgResolutionMinutes === 'number' ? raw.avgResolutionMinutes : 0;
    if (avgResolutionMinutes === 0 && raw.avgResponseTime && typeof raw.avgResponseTime === 'string') {
      const m = raw.avgResponseTime.match(/^(\d+)\s*m/);
      if (m) avgResolutionMinutes = parseInt(m[1], 10);
    }

    return {
      ...raw,
      totalEscalations,
      resolved,
      avgResolutionMinutes,
      slaMet: typeof raw.slaMet === 'number' ? raw.slaMet : 0
    };
  }
}
