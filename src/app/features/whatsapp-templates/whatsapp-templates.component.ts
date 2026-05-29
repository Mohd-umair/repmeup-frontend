import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsAppTemplateService } from '../../core/services/whatsapp-template.service';
import { NotificationService } from '../../core/services/notification.service';
import { EntitlementsStore, FEATURE_KEY } from '../../core/services/entitlements.store';
import { UpgradePromptComponent } from '../../shared/components/upgrade-prompt/upgrade-prompt.component';
import { WhatsAppTemplate, TemplateCategory, TemplateStatus } from '../../core/models/whatsapp-template.model';
import { PlatformService, PlatformConnection } from '../../core/services/platform.service';
import { TemplateCreateComponent } from './template-create/template-create.component';
import { SweetAlertService } from '../../core/services/sweet-alert.service';

@Component({
  selector: 'app-whatsapp-templates',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TemplateCreateComponent, UpgradePromptComponent],
  templateUrl: './whatsapp-templates.component.html',
  styleUrls: ['./whatsapp-templates.component.scss']
})
export class WhatsAppTemplatesComponent implements OnInit, OnDestroy {
  readonly ent = inject(EntitlementsStore);
  readonly FEATURE_KEY = FEATURE_KEY;
  readonly planAllowed = computed(() => this.ent.can(FEATURE_KEY.WHATSAPP_TEMPLATES_MAX));

  templates: WhatsAppTemplate[] = [];
  filteredTemplates: WhatsAppTemplate[] = [];
  connections: PlatformConnection[] = [];
  selectedConnectionId = '';
  filterCategory: TemplateCategory | '' = '';
  filterStatus: TemplateStatus | '' = '';
  searchQuery = '';

  loading = false;
  error = '';
  dataSource: 'meta' | 'db_fallback' = 'meta';

  showCreateModal = false;

  private destroy$ = new Subject<void>();

  readonly categories: { value: TemplateCategory | ''; label: string }[] = [
    { value: '', label: 'All Categories' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'UTILITY', label: 'Utility' },
    { value: 'AUTHENTICATION', label: 'Authentication' }
  ];

  readonly statuses: { value: TemplateStatus | ''; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'PAUSED', label: 'Paused' },
    { value: 'DISABLED', label: 'Disabled' }
  ];

  constructor(
    private templateService: WhatsAppTemplateService,
    private platformService: PlatformService,
    private notificationService: NotificationService,
    private router: Router,
    private swal: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.loadConnections();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  loadConnections(): void {
    this.platformService.getPlatformConnections().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.connections = (res.data || []).filter(c => c.platform === 'whatsapp' && c.isActive);
        if (this.connections.length > 0) {
          this.selectedConnectionId = this.connections[0]._id;
          this.loadTemplates();
        }
      },
      error: () => {
        this.error = 'Failed to load WhatsApp connections.';
      }
    });
  }

  loadTemplates(): void {
    if (!this.selectedConnectionId) return;
    this.loading = true;
    this.error = '';

    this.templateService
      .listTemplates(this.selectedConnectionId, this.filterCategory || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.templates = res.templates || [];
          this.dataSource = res.source;
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          this.error = err?.error?.error || 'Failed to load templates from Meta.';
          this.loading = false;
        }
      });
  }

  // ── Filtering ───────────────────────────────────────────────────────────────

  applyFilters(): void {
    let list = [...this.templates];

    if (this.filterCategory) {
      list = list.filter(t => t.category === this.filterCategory);
    }

    if (this.filterStatus) {
      list = list.filter(t => t.status === this.filterStatus);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q));
    }

    this.filteredTemplates = list;
  }

  onConnectionChange(): void {
    this.loadTemplates();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  onSearch(): void {
    this.applyFilters();
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  onTemplateCreated(): void {
    this.showCreateModal = false;
    this.notificationService.success('Template Created', 'Your template has been submitted to Meta for review.');
    this.loadTemplates();
  }

  deleteTemplate(template: WhatsAppTemplate): void {
    const id = template.id || template.metaTemplateId;
    if (!id) {
      void this.swal.error('Cannot delete', 'This template has no Meta ID. Refresh the list or reconnect WhatsApp.');
      return;
    }

    const title = `Delete "${template.name}"?`;
    const message =
      'This removes the template from your WhatsApp Business account. This action cannot be undone.';

    void this.swal.confirmDelete(title, message).then((result) => {
      if (!result.isConfirmed) return;

      this.templateService
        .deleteTemplate(id, template.name, this.selectedConnectionId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.notificationService.success('Deleted', `Template "${template.name}" deleted.`);
            this.loadTemplates();
          },
          error: (err) => {
            this.notificationService.error(
              'Delete Failed',
              err?.error?.error || 'Could not delete template.'
            );
          }
        });
    });
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────

  statusClass(status: TemplateStatus): string {
    const map: Record<string, string> = {
      APPROVED: 'status-badge--approved',
      IN_REVIEW: 'status-badge--in_review',
      PENDING: 'status-badge--pending',
      REJECTED: 'status-badge--rejected',
      PAUSED: 'status-badge--paused',
      DISABLED: 'status-badge--disabled',
      APPEAL_REQUESTED: 'status-badge--in_review',
      DELETED: 'status-badge--default'
    };
    return map[status] || 'status-badge--default';
  }

  statusIcon(status: TemplateStatus): string {
    const map: Record<string, string> = {
      APPROVED: 'fa-check-circle',
      IN_REVIEW: 'fa-clock',
      PENDING: 'fa-hourglass-half',
      REJECTED: 'fa-times-circle',
      PAUSED: 'fa-pause-circle',
      DISABLED: 'fa-ban',
      APPEAL_REQUESTED: 'fa-file-alt',
      DELETED: 'fa-trash'
    };
    return map[status] || 'fa-question-circle';
  }

  categoryClass(cat: TemplateCategory): string {
    const map: Record<string, string> = {
      MARKETING: 'cat-marketing',
      UTILITY: 'cat-utility',
      AUTHENTICATION: 'cat-auth'
    };
    return map[cat] || '';
  }

  categoryIcon(cat: TemplateCategory): string {
    const map: Record<string, string> = {
      MARKETING: 'fa-bullhorn',
      UTILITY: 'fa-tools',
      AUTHENTICATION: 'fa-shield-alt'
    };
    return map[cat] || 'fa-file-alt';
  }

  bodyText(template: WhatsAppTemplate): string {
    const body = template.components?.find(c => c.type === 'BODY');
    return body?.text || '';
  }

  getQualityClass(score?: string): string {
    const map: Record<string, string> = {
      HIGH: 'quality-high',
      MEDIUM: 'quality-medium',
      LOW: 'quality-low',
      UNKNOWN: 'quality-unknown'
    };
    return map[score || 'UNKNOWN'] || 'quality-unknown';
  }

  trackByTemplate(_: number, t: WhatsAppTemplate): string {
    return (t.id || t.metaTemplateId || t._id || t.name) as string;
  }
}
