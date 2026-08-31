import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { PaymentGatewayService } from '../../../core/services/payment-gateway.service';
import { NotificationService } from '../../../core/services/notification.service';

interface ISummary {
  totalCollected: number;
  pendingAmount: number;
  refundedAmount: number;
  totalCount: number;
  paidCount: number;
  failedCount: number;
  expiredCount: number;
  conversionRate: number;
  byStatus: { _id: string; count: number; amount: number }[];
  byCurrency: { _id: string; amount: number; count: number }[];
}

interface IHealthData {
  integrations: {
    provider: string;
    environment: string;
    status: string;
    lastWebhookAt: string;
    webhookFailureCount: number;
    webhookHealthy: boolean | null;
  }[];
  recentUnknownWebhookEvents: number;
  pendingPaymentsOlderThan3Days: number;
  expiredLinksLast24h: number;
}

@Component({
  selector: 'app-payment-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './payment-analytics.component.html',
  styleUrls: ['./payment-analytics.component.scss']
})
export class PaymentAnalyticsComponent implements OnInit, OnDestroy {
  private paymentService = inject(PaymentGatewayService);
  private notification = inject(NotificationService);
  private destroy$ = new Subject<void>();

  loading = false;
  healthLoading = false;

  from = this._daysAgo(30);
  to = this._today();

  summary: ISummary | null = null;
  timeSeries: { date: string; amount: number; count: number }[] = [];
  byProvider: any[] = [];
  byChannel: any[] = [];
  byAgent: any[] = [];
  health: IHealthData | null = null;

  activeTab: 'overview' | 'health' | 'agents' = 'overview';

  get timeSeriesChartData() {
    if (!this.timeSeries.length) return [];
    const maxAmount = Math.max(...this.timeSeries.map(d => d.amount), 1);
    return this.timeSeries.map(d => ({
      date: d.date,
      amount: d.amount,
      count: d.count,
      pct: Math.round((d.amount / maxAmount) * 100)
    }));
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    const filters: Record<string, string> = {};
    if (this.from) filters['from'] = this.from;
    if (this.to) filters['to'] = this.to;

    Promise.all([
      this.paymentService.getAnalyticsSummary(filters).toPromise(),
      this.paymentService.getAnalyticsTimeSeries(filters).toPromise(),
      this.paymentService.getAnalyticsByProvider(filters).toPromise(),
      this.paymentService.getAnalyticsByChannel(filters).toPromise()
    ])
      .then(([summaryRes, tsRes, provRes, chanRes]) => {
        this.summary = summaryRes?.data ?? null;
        this.timeSeries = tsRes?.data ?? [];
        this.byProvider = provRes?.data ?? [];
        this.byChannel = chanRes?.data ?? [];
      })
      .catch(err => {
        this.notification.error('Failed to load payment analytics');
      })
      .finally(() => {
        this.loading = false;
      });
  }

  loadHealth(): void {
    this.healthLoading = true;
    this.paymentService.getAnalyticsHealth()
      .pipe(takeUntil(this.destroy$), finalize(() => this.healthLoading = false))
      .subscribe({
        next: res => { this.health = res?.data ?? null; },
        error: () => this.notification.error('Failed to load health data')
      });
  }

  loadAgents(): void {
    const filters: Record<string, string> = {};
    if (this.from) filters['from'] = this.from;
    if (this.to) filters['to'] = this.to;
    this.paymentService.getAnalyticsByAgent(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => { this.byAgent = res?.data ?? []; },
        error: () => this.notification.error('Failed to load agent data')
      });
  }

  setTab(tab: 'overview' | 'health' | 'agents'): void {
    this.activeTab = tab;
    if (tab === 'health' && !this.health) this.loadHealth();
    if (tab === 'agents' && !this.byAgent.length) this.loadAgents();
  }

  applyFilter(): void {
    this.load();
    if (this.activeTab === 'agents') this.loadAgents();
  }

  formatAmount(minor: number): string {
    return (minor / 100).toFixed(2);
  }

  providerLabel(p: string): string {
    const map: Record<string, string> = {
      razorpay: 'Razorpay', cashfree: 'Cashfree',
      payu: 'PayU', phonepe: 'PhonePe', stripe: 'Stripe'
    };
    return map[p] ?? p;
  }

  channelLabel(c: string): string {
    const map: Record<string, string> = {
      instagram: 'Instagram', whatsapp: 'WhatsApp', manual: 'Manual'
    };
    return map[c] ?? c;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      paid: 'badge-success', failed: 'badge-danger', expired: 'badge-warning',
      cancelled: 'badge-secondary', pending: 'badge-info', created: 'badge-light',
      authorized: 'badge-primary'
    };
    return map[status] ?? 'badge-light';
  }

  private _daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  private _today(): string {
    return new Date().toISOString().split('T')[0];
  }
}
