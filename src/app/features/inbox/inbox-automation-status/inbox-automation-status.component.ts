import {
  Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  OrganizationService,
  IAutomationStatus,
  IAutomationStatusItem
} from '../../../core/services/organization.service';
import { AiChatBubbleIconComponent } from '../../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

@Component({
  selector: 'app-inbox-automation-status',
  standalone: true,
  imports: [CommonModule, RouterModule, AiChatBubbleIconComponent],
  templateUrl: './inbox-automation-status.component.html'
})
export class InboxAutomationStatusComponent implements OnInit, OnDestroy, OnChanges {
  @Input() orgId!: string;

  status: IAutomationStatus | null = null;
  loading = true;
  expanded = false;

  private destroy$ = new Subject<void>();

  constructor(private orgService: OrganizationService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orgId'] && !changes['orgId'].firstChange) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (!this.orgId) return;
    this.loading = true;
    this.orgService.getAutomationStatus(this.orgId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.status = res.success ? (res.data ?? null) : null;
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  get autoReplyEnabled(): boolean {
    return !!this.status?.autoReply.enabled;
  }

  get quietActive(): boolean {
    return !!this.status?.autoReply.quietHours.isActiveNow;
  }

  get quietEnabled(): boolean {
    return !!this.status?.autoReply.quietHours.enabled;
  }

  get completionScore(): number {
    return this.status?.profileCompleteness.score ?? 0;
  }

  get completionItems(): IAutomationStatusItem[] {
    return this.status?.profileCompleteness.items ?? [];
  }

  get modeLabel(): string {
    switch (this.status?.autoReply.mode) {
      case 'ai_only':       return 'AI Only';
      case 'workflow_only': return 'Workflow Only';
      case 'hybrid':        return 'Hybrid';
      default:              return 'AI Only';
    }
  }

  get quietLabel(): string {
    const qh = this.status?.autoReply.quietHours;
    if (!qh?.enabled) return 'Off';
    return `${qh.start} – ${qh.end}`;
  }

  get quietTimezone(): string {
    return this.status?.autoReply.quietHours.timezone ?? '';
  }

  get completionColor(): string {
    const s = this.completionScore;
    if (s >= 100) return 'bg-green-500';
    if (s >= 75)  return 'bg-rep-lime';
    if (s >= 50)  return 'bg-yellow-500';
    return 'bg-red-500';
  }

  get completionTextColor(): string {
    const s = this.completionScore;
    if (s >= 100) return 'text-green-400';
    if (s >= 75)  return 'text-lime-400';
    if (s >= 50)  return 'text-yellow-400';
    return 'text-red-400';
  }

  get pendingItems(): IAutomationStatusItem[] {
    return this.completionItems.filter(i => !i.done);
  }

  get doneCount(): number {
    return this.completionItems.filter(i => i.done).length;
  }
}
