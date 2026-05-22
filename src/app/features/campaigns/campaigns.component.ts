import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { CampaignService, ICampaign, CampaignStatus } from '../../core/services/campaign.service';
import { NotificationService } from '../../core/services/notification.service';
import { CampaignEditorComponent } from './campaign-editor';
import { CampaignRecipientsReportComponent } from './campaign-recipients-report/campaign-recipients-report.component';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule, CampaignEditorComponent, CampaignRecipientsReportComponent],
  templateUrl: './campaigns.component.html'
})
export class CampaignsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  campaigns: ICampaign[] = [];
  loading = true;
  total = 0;
  page = 1;
  readonly pageSize = 20;

  filterStatus = '';
  actionLoading = new Set<string>();

  // Editor panel
  showEditor = false;
  editingCampaign: ICampaign | null = null;

  // Delete confirm
  confirmDeleteId: string | null = null;

  // Recipients report panel
  reportCampaign: ICampaign | null = null;

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'running', label: 'Running' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'failed', label: 'Failed' }
  ];

  constructor(
    private campaignService: CampaignService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.campaignService
      .listCampaigns({ page: this.page, limit: this.pageSize, status: this.filterStatus || undefined })
      .pipe(takeUntil(this.destroy$), finalize(() => (this.loading = false)))
      .subscribe({
        next: r => {
          this.campaigns = r.campaigns || [];
          this.total = r.total || 0;
        },
        error: () => this.notify.error('Failed to load campaigns')
      });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  openCreate(): void {
    this.editingCampaign = null;
    this.showEditor = true;
  }

  openEdit(campaign: ICampaign): void {
    if (!['draft'].includes(campaign.status)) {
      this.notify.warning('Only draft campaigns can be edited');
      return;
    }
    this.editingCampaign = campaign;
    this.showEditor = true;
  }

  onEditorClose(): void {
    this.showEditor = false;
    this.editingCampaign = null;
  }

  onEditorSaved(): void {
    this.showEditor = false;
    this.editingCampaign = null;
    this.load();
  }

  confirmDelete(id: string): void {
    this.confirmDeleteId = id;
  }

  cancelDelete(): void {
    this.confirmDeleteId = null;
  }

  doDelete(id: string): void {
    this.actionLoading.add(id);
    this.campaignService
      .deleteCampaign(id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.actionLoading.delete(id)))
      .subscribe({
        next: () => {
          this.notify.success('Campaign deleted');
          this.confirmDeleteId = null;
          this.load();
        },
        error: err => this.notify.error(err?.error?.error || 'Failed to delete campaign')
      });
  }

  pauseCampaign(id: string): void {
    this.actionLoading.add(id);
    this.campaignService
      .pauseCampaign(id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.actionLoading.delete(id)))
      .subscribe({
        next: () => { this.notify.success('Campaign paused'); this.load(); },
        error: err => this.notify.error(err?.error?.error || 'Failed to pause')
      });
  }

  resumeCampaign(id: string): void {
    this.actionLoading.add(id);
    this.campaignService
      .resumeCampaign(id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.actionLoading.delete(id)))
      .subscribe({
        next: () => { this.notify.success('Campaign resumed'); this.load(); },
        error: err => this.notify.error(err?.error?.error || 'Failed to resume')
      });
  }

  cancelCampaign(id: string): void {
    this.actionLoading.add(id);
    this.campaignService
      .cancelCampaign(id)
      .pipe(takeUntil(this.destroy$), finalize(() => this.actionLoading.delete(id)))
      .subscribe({
        next: () => { this.notify.success('Campaign cancelled'); this.load(); },
        error: err => this.notify.error(err?.error?.error || 'Failed to cancel')
      });
  }

  openRecipientsReport(campaign: ICampaign): void {
    if (!campaign.stats?.total) {
      this.notify.warning('This campaign has no recipients yet');
      return;
    }
    this.reportCampaign = campaign;
  }

  closeRecipientsReport(): void {
    this.reportCampaign = null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  getTemplateName(campaign: ICampaign): string {
    if (!campaign.templateRef) return '—';
    if (typeof campaign.templateRef === 'string') return campaign.templateRef;
    return campaign.templateRef.name || '—';
  }

  getPhoneDisplay(campaign: ICampaign): string {
    const conn = campaign.connection;
    if (!conn || typeof conn === 'string') return '';
    return conn.platformData?.displayPhoneNumber || conn.platformDisplayName || '';
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page < this.totalPages()) { this.page++; this.load(); }
  }

  statusBadgeClass(status: CampaignStatus): string {
    const map: Record<CampaignStatus, string> = {
      draft:      'bg-gray-500/20 text-gray-400',
      scheduled:  'bg-blue-500/20 text-blue-400',
      running:    'bg-green-500/20 text-green-400',
      paused:     'bg-yellow-500/20 text-yellow-400',
      completed:  'bg-emerald-500/20 text-emerald-400',
      cancelled:  'bg-red-500/20 text-red-400',
      failed:     'bg-red-700/20 text-red-500'
    };
    return map[status] || 'bg-gray-500/20 text-gray-400';
  }

  deliveryPct(campaign: ICampaign): number {
    const { total, sent } = campaign.stats || {};
    if (!total) return 0;
    return Math.round((sent / total) * 100);
  }
}
