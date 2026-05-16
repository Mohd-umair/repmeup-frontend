import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VoiceIvrService } from '../../../core/services/voice-ivr.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  ICallSession,
  IVoiceAgent,
  ICallsListFilter
} from '../../../core/models/voice-ivr.model';

@Component({
  selector: 'app-voice-calls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-calls.component.html',
  styleUrls: ['./voice-calls.component.scss']
})
export class VoiceCallsComponent implements OnInit, OnDestroy {
  loading = false;
  calls: ICallSession[] = [];
  total = 0;
  page = 1;
  limit = 25;

  agents: IVoiceAgent[] = [];

  filter: ICallsListFilter = {
    page: 1,
    limit: 25
  };

  detailLoading = false;
  selected: ICallSession | null = null;

  readonly statusOptions: ICallSession['status'][] = [
    'queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'canceled'
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private voiceSvc: VoiceIvrService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadAgents();
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.filter.page = this.page;
    this.filter.limit = this.limit;
    this.voiceSvc.listCalls(this.filter).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.calls = res.data.items || [];
        this.total = res.data.total || 0;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  resetFilters(): void {
    this.filter = { page: 1, limit: this.limit };
    this.page = 1;
    this.load();
  }

  private loadAgents(): void {
    this.voiceSvc.listAgents().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.agents = res.data || []; }
    });
  }

  prev(): void {
    if (this.page <= 1) return;
    this.page -= 1;
    this.load();
  }
  next(): void {
    if (this.page * this.limit >= this.total) return;
    this.page += 1;
    this.load();
  }

  open(call: ICallSession): void {
    if (!call?._id) return;
    this.detailLoading = true;
    this.selected = call;
    this.voiceSvc.getCall(call._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.selected = res.data; this.detailLoading = false; },
      error: () => { this.detailLoading = false; }
    });
  }

  close(): void {
    this.selected = null;
  }

  agentName(call: ICallSession): string {
    return (typeof call.agent === 'object' && call.agent?.name) || '—';
  }

  formatDuration(seconds?: number): string {
    if (!seconds || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  statusBadgeClass(status: ICallSession['status']): string {
    if (status === 'completed') return 'vi-badge-success';
    if (status === 'in-progress' || status === 'ringing' || status === 'queued') return 'vi-badge-warning';
    return 'vi-badge-danger';
  }

  sentimentBadgeClass(s?: string): string {
    if (s === 'positive') return 'vi-badge-success';
    if (s === 'negative') return 'vi-badge-danger';
    if (s === 'neutral')  return 'vi-badge-info';
    return '';
  }

  get pageInfo(): string {
    if (!this.total) return '0';
    const from = (this.page - 1) * this.limit + 1;
    const to = Math.min(this.page * this.limit, this.total);
    return `${from}–${to} of ${this.total}`;
  }
}
