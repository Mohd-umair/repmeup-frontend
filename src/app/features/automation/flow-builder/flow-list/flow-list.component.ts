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
import { IFlowEnrollment } from '../../../../core/services/flow-builder.service';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { stampRecipeGraph } from '../utils/flow-recipes.util';

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

interface IFlowRecipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  triggerType: string;
  channels: AutomationChannel[];
  flowName: string;
  /** When set, copy the matching ready-made template instead of stamping a mini graph. */
  blueprintNameIncludes?: string;
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

  activeTab: 'my-flows' | 'blueprints' | 'runs' = 'my-flows';
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

  // ── Runs tab ───────────────────────────────────────────────────────────────
  runsFlowId = '';
  runsFlowName = '';
  enrollments: IFlowEnrollment[] = [];
  runsLoading = false;
  runsPage = 1;
  runsTotalPages = 1;
  runsTotal = 0;
  runsPageSize = 20;
  runsStatusFilter = '';
  selectedEnrollment: IFlowEnrollment | null = null;
  enrollmentDetailLoading = false;

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
    {
      value: 'hybrid',
      label: 'Flow Automation + AI',
      description: 'Your flows run first. AI replies only answer when nothing matches. Recommended.',
      icon: 'fas fa-layer-group'
    },
    {
      value: 'workflow_only',
      label: 'Only Flow Automation',
      description: 'Only the flows you build here. AI replies will not answer.',
      icon: 'fas fa-diagram-project'
    },
    {
      value: 'ai_only',
      label: 'Only AI replies',
      description: 'AI replies answer every message. Your flows will not run.',
      icon: 'fas fa-robot'
    }
  ];

  readonly recipes: IFlowRecipe[] = [
    {
      id: 'welcome',
      name: 'Welcome message',
      description: 'First WhatsApp hello.',
      icon: 'fas fa-hand-sparkles',
      triggerType: 'trigger.first_message',
      channels: ['whatsapp'],
      flowName: 'Welcome message'
    },
    {
      id: 'comment_dm',
      name: 'Comment to message',
      description: 'Instagram comment → DM.',
      icon: 'fab fa-instagram',
      triggerType: 'trigger.ig_comment',
      channels: ['instagram'],
      flowName: 'Comment to message'
    },
    {
      id: 'keyword',
      name: 'Keyword reply',
      description: 'Reply to words like “price”.',
      icon: 'fas fa-comment-dots',
      triggerType: 'trigger.keyword',
      channels: ['whatsapp'],
      flowName: 'Keyword reply'
    },
    {
      id: 'book',
      name: 'Book appointment',
      description: 'Offer times and book.',
      icon: 'fas fa-calendar-check',
      triggerType: 'trigger.keyword',
      channels: ['whatsapp'],
      flowName: 'Book appointment',
      blueprintNameIncludes: 'book appointment'
    },
    {
      id: 'custom',
      name: 'Start from scratch',
      description: 'Blank canvas.',
      icon: 'fas fa-pen-ruler',
      triggerType: 'custom',
      channels: ['whatsapp', 'instagram'],
      flowName: 'Untitled'
    }
  ];

  showRecipePicker = false;
  creatingRecipe = false;

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

  setTab(tab: 'my-flows' | 'blueprints' | 'runs'): void {
    this.activeTab = tab;
  }

  openRunsForFlow(flow: IAutomationFlow): void {
    this.runsFlowId = flow._id!;
    this.runsFlowName = flow.name;
    this.runsPage = 1;
    this.runsStatusFilter = '';
    this.selectedEnrollment = null;
    this.activeTab = 'runs';
    this.loadEnrollments();
  }

  loadEnrollments(): void {
    if (!this.runsFlowId) return;
    this.runsLoading = true;
    this.flowService.listEnrollments(this.runsFlowId, {
      page: this.runsPage,
      limit: this.runsPageSize,
      status: this.runsStatusFilter || undefined
    })
      .pipe(takeUntil(this.destroy$), finalize(() => { this.runsLoading = false; }))
      .subscribe({
        next: (r) => {
          this.enrollments = r.data?.enrollments ?? [];
          const pagination = r.data?.pagination;
          this.runsTotal = pagination?.total ?? 0;
          this.runsTotalPages = pagination?.pages ?? 1;
          if (r.data?.flow?.name) this.runsFlowName = r.data.flow.name;
        },
        error: () => this.notify.error('Load failed', 'Could not load run history.')
      });
  }

  viewEnrollmentDetail(enr: IFlowEnrollment): void {
    if (!this.runsFlowId || !enr._id) return;
    this.enrollmentDetailLoading = true;
    this.flowService.getEnrollment(this.runsFlowId, enr._id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.enrollmentDetailLoading = false; }))
      .subscribe({
        next: (r) => { this.selectedEnrollment = r.data ?? null; },
        error: () => this.notify.error('Load failed', 'Could not load run detail.')
      });
  }

  onRunsPageChange(page: number): void {
    this.runsPage = page;
    this.loadEnrollments();
  }

  filterRunsByStatus(status: string): void {
    this.runsStatusFilter = status;
    this.runsPage = 1;
    this.loadEnrollments();
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

  openRecipePicker(): void {
    this.showRecipePicker = true;
  }

  closeRecipePicker(): void {
    if (this.creatingRecipe) return;
    this.showRecipePicker = false;
  }

  createBlank(): void {
    this.openRecipePicker();
  }

  createFromRecipe(recipe: IFlowRecipe): void {
    if (this.creatingRecipe) return;
    if (recipe.id === 'custom') {
      this.createFlowAndOpen({
        name: recipe.flowName,
        channels: recipe.channels,
        nodes: [],
        edges: []
      }, { start: 'custom' });
      return;
    }
    if (recipe.blueprintNameIncludes) {
      const match = this.findBlueprint(recipe.blueprintNameIncludes);
      if (match) {
        this.openBlueprintCopy(match);
        return;
      }
      this.creatingRecipe = true;
      this.flowService.listFlows({ blueprints: 'true' })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (r) => {
            this.blueprints = r.data ?? [];
            this.creatingRecipe = false;
            const bp = this.findBlueprint(recipe.blueprintNameIncludes!);
            if (bp) {
              this.openBlueprintCopy(bp);
              return;
            }
            this.createStampedRecipe(recipe);
          },
          error: () => {
            this.creatingRecipe = false;
            this.createStampedRecipe(recipe);
          }
        });
      return;
    }
    this.createStampedRecipe(recipe);
  }

  useBlueprint(bp: IAutomationFlow): void {
    this.openBlueprintCopy(bp);
  }

  private findBlueprint(nameIncludes: string): IAutomationFlow | undefined {
    const needle = nameIncludes.toLowerCase();
    return this.blueprints.find((b) => (b.name || '').toLowerCase().includes(needle));
  }

  private createStampedRecipe(recipe: IFlowRecipe): void {
    const stamp = stampRecipeGraph(recipe.id);
    this.createFlowAndOpen({
      name: recipe.flowName,
      description: recipe.description,
      channels: recipe.channels,
      entryNodeId: stamp?.entryNodeId || '',
      nodes: stamp?.nodes || [],
      edges: stamp?.edges || []
    });
  }

  private createFlowAndOpen(
    payload: Partial<IAutomationFlow>,
    queryParams?: Record<string, string>
  ): void {
    if (this.creatingRecipe) return;
    this.creatingRecipe = true;
    this.flowService.createFlow(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.creatingRecipe = false; }))
      .subscribe({
        next: (r) => {
          this.showRecipePicker = false;
          if (r.data?._id) {
            const extras = queryParams ? { queryParams } : {};
            this.router.navigate(['/app/automation/flows', r.data._id, 'edit'], extras);
          }
        },
        error: (err) => this.notify.error('Could not create', err.error?.error || 'Please try again.')
      });
  }

  private openBlueprintCopy(bp: IAutomationFlow): void {
    if (!bp._id || this.creatingRecipe) return;
    this.creatingRecipe = true;
    this.flowService.duplicateFlow(bp._id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.creatingRecipe = false; }))
      .subscribe({
        next: (r) => {
          this.showRecipePicker = false;
          if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
        },
        error: (err) => this.notify.error('Could not copy', err.error?.error || 'Please try again.')
      });
  }

  blueprintIcon(bp: IAutomationFlow): string {
    const channels = bp.channels || [];
    if (channels.length === 1) return this.channelIcon(channels[0]);
    if (channels.includes('whatsapp')) return 'fab fa-whatsapp';
    if (channels.includes('instagram')) return 'fab fa-instagram';
    return 'fas fa-layer-group';
  }

  shortBlueprintDesc(bp: IAutomationFlow): string {
    const raw = String(bp.description || '').trim();
    if (!raw) return `${bp.nodes?.length || 0} steps`;
    return raw.length > 48 ? `${raw.slice(0, 45).trimEnd()}…` : raw;
  }

  editFlow(flow: IAutomationFlow): void {
    this.router.navigate(['/app/automation/flows', flow._id, 'edit']);
  }

  duplicateFlow(flow: IAutomationFlow): void {
    if (!flow._id) return;
    this.flowService.duplicateFlow(flow._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.notify.success('Duplicated', `"${flow.name}" was copied.`);
          if (r.data?._id) this.router.navigate(['/app/automation/flows', r.data._id, 'edit']);
          else this.loadFlows();
        },
        error: (err) => this.notify.error('Duplicate failed', err.error?.error || 'Could not duplicate flow.')
      });
  }

  toggleStatus(flow: IAutomationFlow): void {
    if (!flow._id) return;
    const isPausing = flow.status === 'active';
    if (!isPausing && this.isAllChannelsReppyOnly(flow)) {
      void this.swal.warning(
        'This flow will not run',
        'These apps are set to “Only AI replies”. Switch to “Flow Automation + AI” above, then turn this on.'
      );
      return;
    }
    this.swal.confirm(
      isPausing ? `Pause “${flow.name}”?` : `Turn on “${flow.name}”?`,
      isPausing
        ? 'It will stop answering new messages until you turn it on again.'
        : 'It will start answering matching messages right away.',
      isPausing ? 'Yes, pause' : 'Yes, turn on'
    ).then((result) => {
      if (!result.isConfirmed || !flow._id) return;
      this.toggling.add(flow._id);
      const req$ = isPausing
        ? this.flowService.pauseFlow(flow._id)
        : this.flowService.publishFlow(flow._id);
      req$.pipe(takeUntil(this.destroy$), finalize(() => this.toggling.delete(flow._id!)))
        .subscribe({
          next: () => { this.notify.success('Updated', isPausing ? 'Paused.' : 'It’s on.'); this.loadFlows(); },
          error: (err) => this.notify.error('Update failed', err.error?.error || 'Could not update.')
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

  /**
   * Returns true when ALL of the flow's configured channels are set to
   * "Reppy Only" mode — meaning the flow will never actually fire because
   * the AI chatbot mode overrides it on every channel.
   */
  isAllChannelsReppyOnly(flow: IAutomationFlow): boolean {
    const channels = (flow.channels ?? []) as AutomationChannel[];
    if (!channels.length) return false;
    return channels.every(
      (ch) => (this.automationModeByChannel[ch] ?? 'hybrid') === 'ai_only'
    );
  }

  statusClass(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'status-badge--active';
      case 'paused':   return 'status-badge--paused';
      case 'archived': return 'status-badge--archived';
      case 'error':    return 'status-badge--error';
      default:         return 'status-badge--draft';
    }
  }

  statusIcon(status: string | undefined): string {
    switch (status) {
      case 'active':   return 'fa-check-circle';
      case 'paused':   return 'fa-pause-circle';
      case 'archived': return 'fa-archive';
      case 'error':    return 'fa-exclamation-triangle';
      default:         return 'fa-pencil-alt';
    }
  }
}
