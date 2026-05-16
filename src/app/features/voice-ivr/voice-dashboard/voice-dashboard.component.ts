import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VoiceIvrService } from '../../../core/services/voice-ivr.service';
import { SocketService } from '../../../core/services/socket.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  IVoiceAnalyticsSummary,
  ICallSession,
  IVoiceAgent,
  IPhoneNumber
} from '../../../core/models/voice-ivr.model';

@Component({
  selector: 'app-voice-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-dashboard.component.html',
  styleUrls: ['./voice-dashboard.component.scss']
})
export class VoiceDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  summary: IVoiceAnalyticsSummary | null = null;
  activeCalls: Array<{
    callSessionId: string;
    agentId?: string;
    callerNumber?: string;
    direction?: string;
    startedAt: number;
  }> = [];
  recentCalls: ICallSession[] = [];

  // Outbound call modal state
  outboundOpen = false;
  outboundSubmitting = false;
  agents: IVoiceAgent[] = [];
  phoneNumbers: IPhoneNumber[] = [];
  outboundTo = '';
  outboundFromNumberId = '';
  outboundAgentId = '';

  private destroy$ = new Subject<void>();

  constructor(
    private voiceSvc: VoiceIvrService,
    private socket: SocketService,
    private auth: AuthService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadSummary();
    this.loadRecentCalls();
    this.bindSocketEvents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loads ────────────────────────────────────────────────────────────

  private loadSummary(): void {
    this.loading = true;
    this.voiceSvc.getAnalyticsSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.summary = res.data;
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  private loadRecentCalls(): void {
    this.voiceSvc.listCalls({ page: 1, limit: 8 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.recentCalls = res.data.items || []; }
      });
  }

  refresh(): void {
    this.loadSummary();
    this.loadRecentCalls();
  }

  // ── Socket.IO live updates ────────────────────────────────────────────────

  private bindSocketEvents(): void {
    const org = this.auth.currentUserValue?.organization;
    const orgId = typeof org === 'object' && org ? (org as any)._id : org;
    if (orgId) this.socket.joinOrganization(String(orgId));

    this.socket.listen<any>('voice_call_started')
      .pipe(takeUntil(this.destroy$))
      .subscribe((evt) => {
        if (!evt?.callSessionId) return;
        if (this.activeCalls.find((c) => c.callSessionId === evt.callSessionId)) return;
        this.activeCalls = [
          { ...evt, startedAt: Date.now() },
          ...this.activeCalls
        ];
      });

    this.socket.listen<any>('voice_call_completed')
      .pipe(takeUntil(this.destroy$))
      .subscribe((evt) => {
        if (!evt?.callSessionId) return;
        this.activeCalls = this.activeCalls.filter((c) => c.callSessionId !== evt.callSessionId);
      });

    this.socket.listen<any>('voice_call_finalized')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());
  }

  // ── Outbound call modal ───────────────────────────────────────────────────

  openOutbound(): void {
    this.outboundOpen = true;
    this.outboundTo = '';
    this.outboundFromNumberId = '';
    this.outboundAgentId = '';

    this.voiceSvc.listAgents().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.agents = (res.data || []).filter((a) => a.isActive);
        if (this.agents.length) this.outboundAgentId = this.agents[0]._id || '';
      }
    });
    this.voiceSvc.listPhoneNumbers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.phoneNumbers = (res.data || []).filter((p) => p.isActive);
        if (this.phoneNumbers.length) this.outboundFromNumberId = this.phoneNumbers[0]._id;
      }
    });
  }

  closeOutbound(): void {
    this.outboundOpen = false;
  }

  submitOutbound(): void {
    if (!this.outboundTo || !this.outboundFromNumberId || !this.outboundAgentId) {
      this.notify.warning('Required fields missing', 'Please fill destination, from-number, and agent.');
      return;
    }
    this.outboundSubmitting = true;
    this.voiceSvc.createOutboundCall({
      to: this.outboundTo.trim(),
      fromNumberId: this.outboundFromNumberId,
      agentId: this.outboundAgentId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.outboundSubmitting = false;
        this.outboundOpen = false;
        this.notify.success('Outbound call initiated', 'Call is being placed.');
        this.refresh();
      },
      error: (err) => {
        this.outboundSubmitting = false;
        const msg = err?.error?.error || err?.message || 'Failed to start the call.';
        this.notify.error('Outbound call failed', msg);
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatDuration(seconds?: number): string {
    if (!seconds || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  agentName(call: ICallSession): string {
    return (typeof call.agent === 'object' && call.agent?.name) || '—';
  }

  now(): number {
    return Date.now();
  }
}
