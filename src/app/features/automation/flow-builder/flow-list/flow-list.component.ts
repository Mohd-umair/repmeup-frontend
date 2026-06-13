import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FlowBuilderService } from '../../../../core/services/flow-builder.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SweetAlertService } from '../../../../core/services/sweet-alert.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  OrganizationService,
  AutomationMode,
  AutomationChannel,
  AutomationModeByChannel
} from '../../../../core/services/organization.service';
import { IAutomationFlow } from '../../../../core/models/flow-builder.model';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

interface IChannelMeta {
  key: AutomationChannel;
  label: string;
  icon: string;
}

interface IModeOption {
  value: AutomationMode;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-flow-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PaginationComponent],
  templateUrl: './flow-list.component.html',
  styleUrls: ['./flow-list.component.scss']
})
export class FlowListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'my-flows' | 'blueprints' = 'my-flows';
  flows: IAutomationFlow[] = [];
  blueprints: IAutomationFlow[] = [];
  loading = true;
  deleting = new Set<string>();
  toggling = new Set<string>();

  // Pagination (my-flows tab)
  currentPage = 1;
  totalPages = 1;
  total = 0;
  pageSize = 12;

  // ── Automation mode (per channel) ──────────────────────────────────────────
  private orgId = '';
  modeLoading = true;
  modeSaving: AutomationChannel | null = null;
  showModePanel = false;
  automationModeByChannel: AutomationModeByChannel = {
    whatsapp: 'hybrid', instagram: 'hybrid', facebook: 'hybrid'
  };

  readonly channels: IChannelMeta[] = [
    { key: 'whatsapp',  label: 'WhatsApp',  icon: 'fab fa-whatsapp' },
    { key: 'instagram', label: 'Instagram', icon: 'fab fa-instagram' },
    { key: 'facebook',  label: 'Facebook',  icon: 'fab fa-facebook-f' }
  ];

  readonly modeOptions: IModeOption[] = [
    { value: 'workflow_only', label: 'Workflow Only', description: 'Only your flows reply. Reppy never runs.', icon: 'fas fa-diagram-project' },
    { value: 'ai_only',       label: 'Reppy Only',       description: 'Flows are skipped. Reppy AI Auto-Reply handles every message.', icon: 'fas fa-robot' },
    { value: 'hybrid',        label: 'Hybrid',        description: 'Flows run first; AI fills the gap when no flow matches. (Recommended)', icon: 'fas fa-layer-group' }
  ];

  constructor(
    private flowService: FlowBuilderService,
    private notify: NotificationService,
    private swal: SweetAlertService,
    private auth: AuthService,
    private orgService: OrganizationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFlows();
    this.loadBlueprints();
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      if (user?.organization) {
        this.orgId = typeof user.organization === 'string'
          ? user.organization
          : (user.organization as any)._id;
        this.loadAutomationMode();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'my-flows' | 'blueprints'): void {
    this.activeTab = tab;
  }

  loadFlows(): void {
    this.loading = true;
    this.flowService.listFlows({ page: this.currentPage, limit: this.pageSize })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: (r) => {
          this.flows = r.data ?? [];
          this.total = r.total ?? 0;
          this.totalPages = r.pages ?? Math.max(1, Math.ceil(this.total / this.pageSize));
        },
        error: () => this.notify.error('Load failed', 'Could not load automation flows.')
      });
  }

  loadBlueprints(): void {
    this.flowService.listFlows({ blueprints: 'true' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => { this.blueprints = r.data ?? []; } });
  }

  // ── Automation mode ─────────────────────────────────────────────────────────

  loadAutomationMode(): void {
    this.modeLoading = true;
    this.orgService.getOrganization(this.orgId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.modeLoading = false; }))
      .subscribe({
        next: (r) => {
          const modes = r.data?.automationModeByChannel;
          if (modes) {
            this.automationModeByChannel = {
              whatsapp:  modes.whatsapp  ?? 'hybrid',
              instagram: modes.instagram ?? 'hybrid',
              facebook:  modes.facebook  ?? 'hybrid'
            };
          }
        },
        error: () => { /* keep defaults; non-blocking */ }
      });
  }

  toggleModePanel(): void {
    this.showModePanel = !this.showModePanel;
  }

  modeFor(channel: AutomationChannel): AutomationMode {
    return this.automationModeByChannel[channel] ?? 'hybrid';
  }

  /** Persist a single channel's mode (optimistic UI, reverts on error). */
  setChannelMode(channel: AutomationChannel, mode: AutomationMode): void {
    if (this.modeFor(channel) === mode || this.modeSaving) return;
    const previous = this.modeFor(channel);
    this.automationModeByChannel = { ...this.automationModeByChannel, [channel]: mode };
    this.modeSaving = channel;

    this.orgService.updateAutomationModeByChannel(this.orgId, { [channel]: mode })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.modeSaving = null; }))
      .subscribe({
        next: (r) => {
          const saved = r.data?.automationModeByChannel?.[channel];
          if (saved) {
            this.automationModeByChannel = { ...this.automationModeByChannel, [channel]: saved };
          }
          const label = this.channels.find(c => c.key === channel)?.label || channel;
          this.notify.success('Updated', `${label} automation set to ${this.modeLabel(mode)}.`);
        },
        error: (err) => {
          this.automationModeByChannel = { ...this.automationModeByChannel, [channel]: previous };
          this.notify.error('Update failed', err?.error?.error || 'Could not update automation mode.');
        }
      });
  }

  modeLabel(mode: AutomationMode): string {
    return this.modeOptions.find(o => o.value === mode)?.label || mode;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadFlows();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadFlows();
  }

  createBlank(): void {
    this.flowService.createFlow({
      name: 'Untitled flow',
      channels: ['whatsapp', 'instagram'],
      nodes: [],
      edges: []
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => {
        if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
      },
      error: (err) => this.notify.error('Create failed', err.error?.error || 'Could not create flow.')
    });
  }

  useBlueprint(bp: IAutomationFlow): void {
    this.flowService.duplicateFlow(bp._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
        },
        error: (err) => this.notify.error('Import failed', err.error?.error || 'Could not import blueprint.')
      });
  }

  editFlow(flow: IAutomationFlow): void {
    this.router.navigate(['/app/automation/flows', flow._id, 'edit']);
  }

  toggleStatus(flow: IAutomationFlow): void {
    if (!flow._id) return;
    const isPausing = flow.status === 'active';
    this.swal.confirm(
      isPausing ? `Pause "${flow.name}"?` : `Publish "${flow.name}"?`,
      isPausing
        ? 'The flow will stop processing new triggers until resumed.'
        : 'The flow will go live and start processing triggers.',
      isPausing ? 'Yes, pause it' : 'Yes, publish it'
    ).then((result) => {
      if (!result.isConfirmed || !flow._id) return;
      this.toggling.add(flow._id);
      const req$ = isPausing
        ? this.flowService.pauseFlow(flow._id)
        : this.flowService.publishFlow(flow._id);
      req$.pipe(takeUntil(this.destroy$), finalize(() => this.toggling.delete(flow._id!)))
        .subscribe({
          next: () => { this.notify.success('Updated', 'Flow status updated.'); this.loadFlows(); },
          error: (err) => this.notify.error('Update failed', err.error?.error || 'Could not update flow.')
        });
    });
  }

  deleteFlow(flow: IAutomationFlow): void {
    if (!flow._id) return;
    this.swal.confirmDelete(
      `Delete "${flow.name}"?`,
      'This flow will be permanently removed and cannot be recovered.'
    ).then((result) => {
      if (!result.isConfirmed || !flow._id) return;
      this.deleting.add(flow._id);
      this.flowService.deleteFlow(flow._id)
        .pipe(takeUntil(this.destroy$), finalize(() => this.deleting.delete(flow._id!)))
        .subscribe({
          next: () => {
            this.notify.success('Deleted', 'Flow removed.');
            if (this.flows.length === 1 && this.currentPage > 1) this.currentPage--;
            this.loadFlows();
          },
          error: (err) => this.notify.error('Delete failed', err.error?.error || 'Could not delete flow.')
        });
    });
  }

  channelClass(ch: string): string {
    switch (ch.toLowerCase()) {
      case 'whatsapp':  return 'flow-cat--whatsapp';
      case 'instagram': return 'flow-cat--instagram';
      case 'facebook':  return 'flow-cat--facebook';
      default:          return 'flow-cat--default';
    }
  }

  channelIcon(ch: string): string {
    switch (ch.toLowerCase()) {
      case 'whatsapp':  return 'fab fa-whatsapp';
      case 'instagram': return 'fab fa-instagram';
      case 'facebook':  return 'fab fa-facebook-f';
      default:          return 'fas fa-globe';
    }
  }

  statusClass(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'status-badge--active';
      case 'paused':   return 'status-badge--paused';
      case 'archived': return 'status-badge--archived';
      default:         return 'status-badge--draft';
    }
  }

  statusIcon(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'fa-check-circle';
      case 'paused':   return 'fa-pause-circle';
      case 'archived': return 'fa-archive';
      default:         return 'fa-pencil-alt';
    }
  }
}
