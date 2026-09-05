import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil, finalize } from 'rxjs/operators';
import { FlowBuilderService } from '../../../../core/services/flow-builder.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { SweetAlertService } from '../../../../core/services/sweet-alert.service';
import { WhatsAppTemplateService } from '../../../../core/services/whatsapp-template.service';
import { PlatformConnectionService, PlatformConnection } from '../../../../core/services/platform-connection.service';
import { IntentBucketService } from '../../../../core/services/intent-bucket.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { AppointmentService } from '../../../../core/services/appointment.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  OrganizationService,
  AutomationChannel,
  AutomationModeByChannel
} from '../../../../core/services/organization.service';
import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
import { MediaSelectorModalComponent } from '../../../../shared/components/media-selector-modal/media-selector-modal.component';
import { Media } from '../../../../core/models/media.model';
import {
  IAutomationFlow,
  IFlowEdge,
  IFlowNode,
  IFlowNodeCatalogItem,
  IFlowValidationResult,
  FlowChannel,
  NodeCategory
} from '../../../../core/models/flow-builder.model';
import {
  buildDefaultConfig,
  ensureNodeConfigKeys,
  inheritConfigOnConnect,
  formatStringArray,
  parseStringArray,
  formatJsonField,
  parseJsonField,
  getConfigFieldDef,
  isDurationField,
  inferDurationUnit,
  secondsToAmount,
  durationToSeconds,
  DurationUnit
} from '../utils/flow-node-defaults.util';
import {
  SIMPLE_PALETTE_TYPES,
  stampByTriggerType,
  IStampedFlow,
  simpleNodeLabel,
  humanEdgeLabel,
  slugFromTitle,
  fillPreviewVars
} from '../utils/flow-recipes.util';

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'condition', 'wait', 'control'];
const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'When',
  action: 'Then',
  condition: 'If',
  wait: 'Wait',
  control: 'End'
};

/**
 * Feature-based palette groups — finer than the raw category, so related nodes
 * (e.g. all Appointment nodes) sit together. Each node maps to exactly one group
 * via `groupOf()`; the order below is the display order.
 */
interface IPaletteGroup { id: string; label: string; simpleLabel?: string; icon: string; }
const PALETTE_GROUPS: IPaletteGroup[] = [
  { id: 'trigger',     label: 'When this happens', simpleLabel: 'When this happens', icon: 'fas fa-bolt' },
  { id: 'messaging',   label: 'Send a message',    simpleLabel: 'Send something',    icon: 'fas fa-comment-dots' },
  { id: 'handoff',     label: 'Send to a person',  simpleLabel: 'Send to a person',  icon: 'fas fa-headset' },
  { id: 'appointment', label: 'Appointments',      icon: 'fas fa-calendar-check' },
  { id: 'commerce',    label: 'Orders & payments', icon: 'fas fa-bag-shopping' },
  { id: 'instagram',   label: 'Instagram',         icon: 'fab fa-instagram' },
  { id: 'ai',          label: 'AI replies',        icon: 'fas fa-robot' },
  { id: 'utility',     label: 'More actions',      icon: 'fas fa-sliders' },
  { id: 'logic',       label: 'If…',               icon: 'fas fa-code-branch' },
  { id: 'wait',        label: 'Wait',              simpleLabel: 'Wait',              icon: 'fas fa-hourglass-half' },
  { id: 'control',     label: 'Stop / jump',       simpleLabel: 'Stop',              icon: 'fas fa-flag-checkered' },
  { id: 'other',       label: 'Other',             icon: 'fas fa-shapes' }
];
const APPOINTMENT_NODE_TYPES = new Set([
  'action.offer_services', 'action.offer_slots', 'action.book_appointment',
  'action.reschedule_appointment', 'action.cancel_appointment', 'trigger.appointment_event'
]);
const COMMERCE_NODE_TYPES = new Set([
  'action.send_product', 'action.send_product_list', 'action.send_catalog',
  'action.send_catalog_product', 'action.send_order_details', 'action.create_order',
  'action.save_shipping_address', 'action.save_payment_method', 'action.load_saved_address'
]);
const INSTAGRAM_NODE_TYPES = new Set([
  'action.reply_public_comment', 'action.send_post_products', 'action.link_comment_thread', 'action.set_stage'
]);

@Component({
  selector: 'app-flow-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MediaSelectorModalComponent],
  templateUrl: './flow-builder.component.html',
  styleUrls: ['./flow-builder.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlowBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private save$ = new Subject<void>();

  flowId = '';
  flow: IAutomationFlow | null = null;
  catalog: IFlowNodeCatalogItem[] = [];
  catalogFilter = '';
  paletteSimpleMode = true;
  selectedNodeId: string | null = null;
  selectedEdgeId: string | null = null;
  connectingFrom: string | null = null;
  loading = true;
  saving = false;
  publishing = false;

  // Right-rail panels (only one open at a time alongside the inspector)
  showValidation = false;
  showSettings = false;
  showTest = false;
  validationErrors: IFlowValidationResult['errors'] = [];
  validating = false;
  testResult: {
    startNodeId: string;
    simulationStatus: string;
    lastError: string;
    variables: Record<string, unknown>;
    stepPreview: Array<{ nodeId: string; type: string; label: string; event: string }>;
  } | null = null;
  testing = false;

  // Pickers
  intentBuckets: Array<{ _id: string; name: string }> = [];
  products: Array<{ _id: string; name: string }> = [];
  services: Array<{ _id: string; name: string }> = [];
  providers: Array<{ _id: string; name: string }> = [];
  readonly edgeBranchPresets = ['yes', 'no', 'reply', 'no_reply'];

  @ViewChild('canvasWrap') canvasWrap?: ElementRef<HTMLElement>;

  canvasOffset = { x: 0, y: 0 };
  zoom = 1;
  private readonly minZoom = 0.25;
  private readonly maxZoom = 2;
  /** Collapse side rails to maximize canvas workspace. */
  paletteCollapsed = false;
  inspectorCollapsed = false;
  focusMode = false;
  private dragNode: IFlowNode | null = null;
  private dragStart = { x: 0, y: 0, nx: 0, ny: 0 };
  private panning = false;
  private panStart = { x: 0, y: 0, ox: 0, oy: 0 };

  /** Pointer drag from the palette onto the canvas (HTML5 DnD is unreliable here). */
  palettePress: {
    item: IFlowNodeCatalogItem;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null = null;
  paletteGhost: { x: number; y: number; label: string } | null = null;

  // ── Performance caches ─────────────────────────────────────────────────────
  /**
   * Pre-computed field descriptors for the currently selected node.
   * Rebuilt only when node selection changes — eliminates catalog.find() on
   * every Angular change-detection cycle triggered by inspector input events.
   */
  selectedNodeFieldDefs: Array<{
    key: string;
    label: string;
    type: string;
    hint: string;
    options: string[];
    isWaTemplatePicker: boolean;
    isPlainString: boolean;
  }> = [];

  /** Cached set of node ids that have validation errors. Rebuilt only when validationErrors changes. */
  private _invalidNodeIds = new Set<string>();

  /** Undo stack for destructive canvas operations (node or edge delete). Max 10 entries. */
  readonly _undoStack: Array<{
    type: 'node_delete' | 'edge_delete';
    nodes: IFlowNode[];
    edges: IFlowEdge[];
  }> = [];
  private readonly _maxUndo = 10;

  /** rAF handle — throttles pointermove to one CD cycle per animation frame. */
  private _rafId: number | null = null;
  private _pendingPointerEvent: PointerEvent | null = null;

  readonly categoryOrder = CATEGORY_ORDER;
  readonly categoryLabels = CATEGORY_LABELS;
  channelOptions: FlowChannel[] = ['whatsapp', 'instagram', 'facebook'];
  // Palette starts with the feature groups open; generic groups collapsed.
  collapsedCats = new Set(['appointment', 'commerce', 'instagram', 'ai', 'utility', 'logic', 'other']);

  waConnections: PlatformConnection[] = [];
  waConnectionId = '';
  waTemplates: WhatsAppTemplate[] = [];
  waTemplatesLoading = false;
  waTemplatesError = '';

  /** All active connections keyed by platform — used for disconnected-channel banner. */
  allConnections: PlatformConnection[] = [];
  /** Channels used by current flow that have NO active connection. */
  disconnectedChannels: string[] = [];
  channelBannerDismissed = false;
  modeBannerDismissed = false;

  /** Per-channel reply mode — used to block Turn on when flows cannot fire. */
  automationModeByChannel: AutomationModeByChannel = {
    whatsapp: 'hybrid', instagram: 'hybrid', facebook: 'hybrid'
  };
  private orgId = '';

  /** Remember which time unit the user last picked for delay/timeout fields. */
  private durationUnitByField = new Map<string, DurationUnit>();

  /** Empty-canvas starter recipes (same as list page). */
  readonly canvasStarters: Array<{ label: string; hint: string; icon: string; triggerType: string }> = [
    { label: 'First WhatsApp message', hint: 'Welcome them', icon: 'fas fa-hand-sparkles', triggerType: 'trigger.first_message' },
    { label: 'Instagram comment', hint: 'Reply in DM', icon: 'fab fa-instagram', triggerType: 'trigger.ig_comment' },
    { label: 'They type a word', hint: 'Keyword reply', icon: 'fas fa-comment-dots', triggerType: 'trigger.keyword' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private flowService: FlowBuilderService,
    private notify: NotificationService,
    private swal: SweetAlertService,
    private whatsAppTemplateService: WhatsAppTemplateService,
    private platformConnectionService: PlatformConnectionService,
    private intentBucketService: IntentBucketService,
    private catalogService: CatalogService,
    private appointmentService: AppointmentService,
    private auth: AuthService,
    private orgService: OrganizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.flowId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.flowId) {
      this.router.navigate(['/app/automation/flows']);
      return;
    }

    this.save$.pipe(debounceTime(800), takeUntil(this.destroy$)).subscribe(() => this.persist());

    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      if (user?.organization) {
        this.orgId = typeof user.organization === 'string'
          ? user.organization
          : (user.organization as { _id?: string })._id || '';
        this.loadAutomationMode();
      }
    });

    this.flowService.getNodeCatalog(this.channelOptions)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.catalog = r.data ?? [];
          this.loadWaConnections();
          this.loadPickerData();
          this.loadFlow();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadWaConnections();
          this.loadFlow();
        }
      });
  }

  /** Load reference lists for inspector pickers (buckets, products). */
  private loadPickerData(): void {
    this.intentBucketService.getBuckets({ limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const list = res?.data?.buckets ?? res?.data ?? res?.buckets ?? [];
          this.intentBuckets = (list || []).map((b: any) => ({ _id: b._id, name: b.name }));
          this.cdr.markForCheck();
        },
        error: () => { this.intentBuckets = []; }
      });

    this.catalogService.getProducts({ isActive: true, limit: 200 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const list = res?.data?.products ?? [];
          this.products = (list || []).map((p: any) => ({ _id: p._id, name: p.name }));
          this.cdr.markForCheck();
        },
        error: () => { this.products = []; }
      });

    // Appointment services + providers (for offer_slots / book_appointment pickers).
    this.appointmentService.listServices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => { this.services = (list || []).map((s) => ({ _id: s._id, name: s.name })); this.cdr.markForCheck(); },
        error: () => { this.services = []; }
      });
    this.appointmentService.listProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => { this.providers = (list || []).map((p) => ({ _id: p._id, name: p.name })); this.cdr.markForCheck(); },
        error: () => { this.providers = []; }
      });
  }

  ngOnDestroy(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedNode(): IFlowNode | null {
    return this.flow?.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  get filteredCatalog(): IFlowNodeCatalogItem[] {
    const q = this.catalogFilter.trim().toLowerCase();
    const channels = this.flow?.channels ?? [];
    return this.catalog.filter((item) => {
      const channelOk = item.supportedChannels.some((c) => channels.includes(c as FlowChannel));
      if (!channelOk) return false;
      if (this.paletteSimpleMode && !q && !SIMPLE_PALETTE_TYPES.has(item.type)) return false;
      if (!q) return true;
      const hay = `${item.label} ${item.type} ${simpleNodeLabel(item.type)}`.toLowerCase();
      return hay.includes(q);
    });
  }

  catalogByCategory(cat: NodeCategory): IFlowNodeCatalogItem[] {
    return this.filteredCatalog.filter((c) => c.category === cat);
  }

  /** Feature group a node belongs to (used for the grouped palette). */
  groupOf(item: IFlowNodeCatalogItem): string {
    if (this.paletteSimpleMode) {
      if (item.category === 'trigger') return 'trigger';
      if (item.type === 'action.escalate_human') return 'handoff';
      if (item.type === 'action.send_text' || item.type === 'action.send_media' || item.type === 'action.send_buttons') {
        return 'messaging';
      }
      if (item.category === 'wait') return 'wait';
      if (item.category === 'control') return 'control';
    }
    if (item.category === 'trigger') return 'trigger';
    const t = item.type;
    if (APPOINTMENT_NODE_TYPES.has(t)) return 'appointment';
    if (COMMERCE_NODE_TYPES.has(t)) return 'commerce';
    if (INSTAGRAM_NODE_TYPES.has(t)) return 'instagram';
    if (t.startsWith('action.ai_')) return 'ai';
    if (item.category === 'action') return t.includes('send_') ? 'messaging' : 'utility';
    if (item.category === 'condition') return 'logic';
    if (item.category === 'wait') return 'wait';
    if (item.category === 'control') return 'control';
    return 'other';
  }

  catalogByGroup(groupId: string): IFlowNodeCatalogItem[] {
    return this.filteredCatalog.filter((c) => this.groupOf(c) === groupId);
  }

  /** Maps palette feature groups to category colour tokens (--cat / --cat-soft). */
  groupCatClass(groupId: string): string {
    switch (groupId) {
      case 'trigger':
        return 'fb-cat-trigger';
      case 'logic':
        return 'fb-cat-condition';
      case 'wait':
        return 'fb-cat-wait';
      case 'control':
        return 'fb-cat-control';
      case 'handoff':
        return 'fb-cat-action';
      default:
        return 'fb-cat-action';
    }
  }

  /** Palette groups that actually have visible nodes (in display order). */
  get paletteGroups(): IPaletteGroup[] {
    return PALETTE_GROUPS
      .filter((g) => this.catalogByGroup(g.id).length > 0)
      .map((g) => this.paletteSimpleMode && g.simpleLabel ? { ...g, label: g.simpleLabel } : g);
  }

  loadFlow(): void {
    this.loading = true;
    this.flowService.getFlow(this.flowId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (r) => {
          this.flow = r.data ?? null;
          if (this.flow && !this.flow.nodes.length) {
            const start = this.route.snapshot.queryParamMap.get('start');
            if (start && start !== 'custom') {
              const stamp = stampByTriggerType(start);
              if (stamp) this.applyStampedFlow(stamp);
              else {
                const match = this.catalog.find((c) => c.type === start);
                if (match) this.addNodeFromCatalog(match);
              }
            }
          }
          this.refreshDisconnectedChannels();
          this.cdr.markForCheck();
          requestAnimationFrame(() => this.fitView());
        },
        error: () => {
          this.notify.error('Load failed', 'Could not load flow.');
          this.router.navigate(['/app/automation/flows']);
        }
      });
  }

  queueSave(): void {
    this.save$.next();
  }

  persist(): void {
    if (!this.flow?._id || this.saving) return;
    this.saving = true;
    const trigger = this.flow.nodes.find((n) => n.type.startsWith('trigger.'));
    this.flow.entryNodeId = trigger?.id || this.flow.entryNodeId;

    this.flowService.updateFlow(this.flow._id, this.flow)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          // Silently re-validate in background so the badge stays accurate.
          if (this.flow?._id && this.flow.status !== 'active') {
            this.flowService.validateFlow(this.flow._id)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (r) => {
                  this.validationErrors = r.data?.errors ?? [];
                  this.refreshInvalidNodeIds();
                  this.cdr.markForCheck();
                }
              });
          }
        },
        error: (err) => this.notify.error('Save failed', err.error?.error || 'Could not save flow.')
      });
  }

  saveNow(): void {
    this.persist();
  }

  async publish(): Promise<void> {
    if (!this.flow?._id) return;

    if (this.flowCannotFire) {
      await this.swal.warning(
        'This flow will not run',
        'These channels are set to “Only AI replies”, so Flow Automation stays off. Switch to “Flow Automation + AI” on the Flow Automation page, then try again.'
      );
      return;
    }

    const trigger = this.flow.nodes.find((n) => n.type.startsWith('trigger.'));
    const triggerLabel = trigger
      ? (this.catalog.find((c) => c.type === trigger.type)?.label ?? 'when something happens')
      : 'not set yet — add a “When this happens” block';
    const channelNames = (this.flow.channels ?? []).map((c) => this.channelDisplayLabel(c)).join(', ') || 'None';
    const sendNode = this.flow.nodes.find((n) => n.type.startsWith('action.send_') || n.type === 'action.ai_reply');
    const thenLabel = sendNode
      ? (this.catalog.find((c) => c.type === sendNode.type)?.label ?? 'send a message')
      : 'nothing yet — add a “Then do this” block';

    const disconnectedWarn = this.disconnectedChannels.length > 0
      ? `<p style="color:#f59e0b;margin-top:0.5rem"><i class="fas fa-exclamation-triangle"></i> <strong>${this.disconnectedChannels.map((c) => this.channelDisplayLabel(c)).join(', ')}</strong> is not connected. Connect it in Settings or messages will not send.</p>`
      : '';

    const html = `
      <div style="text-align:left;font-size:0.875rem;line-height:1.65">
        <p>When you turn this on:</p>
        <ul style="margin:0.5rem 0 0.75rem 1.1rem;padding:0">
          <li><strong>When:</strong> ${triggerLabel}</li>
          <li><strong>On:</strong> ${channelNames}</li>
          <li><strong>Then:</strong> ${thenLabel}</li>
        </ul>
        ${disconnectedWarn}
        <p style="margin-top:0.5rem;color:#9ca3af">It starts working on the next matching message. You can pause it anytime.</p>
      </div>`;

    const result = await this.swal.confirmHtml('Turn this on?', html, 'Turn on', 'Not yet');
    if (!result.isConfirmed) return;

    this.publishing = true;
    this.cdr.markForCheck();
    this.flowService.publishFlow(this.flow._id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.publishing = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (r) => {
          this.flow = r.data ?? this.flow;
          this.notify.success('It’s on', 'This flow is now live.');
        },
        error: (err) => this.notify.error('Could not turn on', err.error?.error || 'Fix the highlighted blocks first.')
      });
  }

  validate(): void {
    if (!this.flow?._id) return;
    this.openPanel('validation');
    this.validating = true;
    // Validate the in-memory graph so unsaved edits are reflected.
    this.flowService.updateFlow(this.flow._id, this.flow)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.flowService.validateFlow(this.flow!._id!)
            .pipe(takeUntil(this.destroy$), finalize(() => { this.validating = false; this.cdr.markForCheck(); }))
            .subscribe({
              next: (r) => {
                this.validationErrors = r.data?.errors ?? [];
                this.refreshInvalidNodeIds();
                if (r.data?.valid) this.notify.success('Valid', 'Flow passed validation.');
                this.cdr.markForCheck();
              }
            });
        },
        error: () => { this.validating = false; this.cdr.markForCheck(); }
      });
  }

  /** Node ids flagged by the latest validation run, for canvas highlighting. */
  get invalidNodeIds(): Set<string> {
    return this._invalidNodeIds;
  }

  private refreshInvalidNodeIds(): void {
    const ids = new Set<string>();
    for (const e of this.validationErrors) {
      if (e.nodeId) ids.add(e.nodeId);
      (e.nodeIds || []).forEach((id: string) => ids.add(id));
    }
    this._invalidNodeIds = ids;
  }

  nodeHasError(id: string): boolean {
    return this.invalidNodeIds.has(id);
  }

  focusNode(id: string): void {
    this.selectNode(id);
    const node = this.flow?.nodes.find((n) => n.id === id);
    if (node) {
      // Center the node in the viewport-ish.
      this.canvasOffset = { x: 240 - node.position.x * this.zoom, y: 180 - node.position.y * this.zoom };
    }
    this.cdr.markForCheck();
  }

  // ── Right-rail panels ──────────────────────────────────────────────────────
  openPanel(panel: 'validation' | 'settings' | 'test'): void {
    this.showValidation = panel === 'validation';
    this.showSettings = panel === 'settings';
    this.showTest = panel === 'test';
    this.cdr.markForCheck();
  }

  closePanels(): void {
    this.showValidation = this.showSettings = this.showTest = false;
    this.cdr.markForCheck();
  }

  ensureSettings(): void {
    if (this.flow && !this.flow.settings) this.flow.settings = {};
  }

  runTest(): void {
    if (!this.flow?._id) return;
    this.openPanel('test');
    this.testing = true;
    this.flowService.updateFlow(this.flow._id, this.flow)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.flowService.testFlow(this.flow!._id!)
            .pipe(takeUntil(this.destroy$), finalize(() => { this.testing = false; this.cdr.markForCheck(); }))
            .subscribe({
              next: (r) => {
                this.validationErrors = r.data?.validation?.errors ?? [];
                this.refreshInvalidNodeIds();
                this.testResult = r.data
                  ? {
                      startNodeId: r.data.startNodeId,
                      simulationStatus: (r.data as any).simulationStatus || '',
                      lastError: (r.data as any).lastError || '',
                      variables: (r.data as any).variables || {},
                      stepPreview: (r.data.stepPreview as any) || []
                    }
                  : null;
                this.cdr.markForCheck();
              },
              error: (err) => this.notify.error('Test failed', err.error?.error || 'Could not run test.')
            });
        },
        error: () => { this.testing = false; this.cdr.markForCheck(); }
      });
  }

  // ── Zoom & pan ─────────────────────────────────────────────────────────────
  zoomIn(): void { this.setZoom(this.zoom + 0.1); }
  zoomOut(): void { this.setZoom(this.zoom - 0.1); }
  zoomReset(): void { this.zoom = 1; this.canvasOffset = { x: 0, y: 0 }; this.cdr.markForCheck(); }

  private setZoom(z: number): void {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, Math.round(z * 100) / 100));
    this.cdr.markForCheck();
  }

  get zoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  /** Canvas grows with node positions so large flows always have room to pan. */
  get canvasMinWidth(): number {
    if (!this.flow?.nodes.length) return 3200;
    const maxX = Math.max(...this.flow.nodes.map((n) => n.position.x));
    return Math.max(3200, maxX + 480);
  }

  get canvasMinHeight(): number {
    if (!this.flow?.nodes.length) return 2000;
    const maxY = Math.max(...this.flow.nodes.map((n) => n.position.y));
    return Math.max(2000, maxY + 360);
  }

  togglePalette(): void {
    this.paletteCollapsed = !this.paletteCollapsed;
    if (this.paletteCollapsed && this.inspectorCollapsed) this.focusMode = true;
    else if (!this.paletteCollapsed || !this.inspectorCollapsed) this.focusMode = false;
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.fitView());
  }

  toggleInspector(): void {
    this.inspectorCollapsed = !this.inspectorCollapsed;
    if (this.paletteCollapsed && this.inspectorCollapsed) this.focusMode = true;
    else if (!this.paletteCollapsed || !this.inspectorCollapsed) this.focusMode = false;
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.fitView());
  }

  /** Collapse both side panels for maximum canvas area. */
  toggleFocusMode(): void {
    this.focusMode = !this.focusMode;
    this.paletteCollapsed = this.focusMode;
    this.inspectorCollapsed = this.focusMode;
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.fitView());
  }

  /** Frame all nodes within the visible canvas viewport. */
  fitView(): void {
    if (!this.flow?.nodes.length) { this.zoomReset(); return; }
    const wrap = this.canvasWrap?.nativeElement;
    const vw = wrap?.clientWidth ?? 1200;
    const vh = wrap?.clientHeight ?? 700;
    const pad = 48;
    const xs = this.flow.nodes.map((n) => n.position.x);
    const ys = this.flow.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + 224;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + 100;
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const z = Math.min(this.maxZoom, Math.max(this.minZoom, Math.min((vw - pad * 2) / w, (vh - pad * 2) / h)));
    this.zoom = Math.round(z * 100) / 100;
    this.canvasOffset = {
      x: pad + (vw - pad * 2 - w * this.zoom) / 2 - minX * this.zoom,
      y: pad + (vh - pad * 2 - h * this.zoom) / 2 - minY * this.zoom
    };
    this.cdr.markForCheck();
  }

  onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    this.setZoom(this.zoom + delta);
  }

  onCanvasPointerDown(event: PointerEvent): void {
    if (this.palettePress) return;
    // Start panning only when the empty canvas background is grabbed.
    const target = event.target as HTMLElement;
    if (target.closest('.fb-node') || target.closest('.fb-edge-hit')) return;
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.panning = true;
    this.panStart = { x: event.clientX, y: event.clientY, ox: this.canvasOffset.x, oy: this.canvasOffset.y };
    this.cdr.markForCheck();
  }

  /** Click-to-add: drops a node below the selected (or last) block and wires it. */
  addNodeFromCatalog(item?: IFlowNodeCatalogItem): void {
    if (!this.flow || !item) return;
    this.createNodeAt(item);
  }

  /**
   * Find the first grid-aligned canvas position that does not overlap any
   * existing node. Nodes are treated as 240×100 px bounding boxes with 20px
   * gutters on each side so we scan on a 260×120 grid.
   */
  private findFreePosition(): { x: number; y: number } {
    const NODE_W = 240, NODE_H = 100, GAP_X = 20, GAP_Y = 20;
    const STEP_X = NODE_W + GAP_X, STEP_Y = NODE_H + GAP_Y;
    const COLS = 4;

    const occupied = (this.flow?.nodes || []).map((n) => n.position);

    const overlaps = (cx: number, cy: number): boolean =>
      occupied.some(
        (p) =>
          cx < p.x + NODE_W + GAP_X &&
          cx + NODE_W + GAP_X > p.x &&
          cy < p.y + NODE_H + GAP_Y &&
          cy + NODE_H + GAP_Y > p.y
      );

    const START_X = 80, START_Y = 80;
    for (let row = 0; row < 50; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = START_X + col * STEP_X;
        const y = START_Y + row * STEP_Y;
        if (!overlaps(x, y)) return { x, y };
      }
    }
    // Absolute fallback — should never be reached in practice
    return { x: START_X, y: START_Y + occupied.length * STEP_Y };
  }

  /** Shared node factory used by both click-to-add and drag-and-drop. */
  private createNodeAt(item: IFlowNodeCatalogItem, dropX?: number, dropY?: number): void {
    if (!this.flow) return;
    const fromDrop = dropX != null && dropY != null;
    const source = this.autoConnectSource(item.type);
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let x: number;
    let y: number;
    if (fromDrop) {
      x = Math.max(0, Math.round(dropX!));
      y = Math.max(0, Math.round(dropY!));
    } else if (source) {
      const stacked = this.stackPosition(source);
      x = stacked.x;
      y = stacked.y;
    } else {
      const free = this.findFreePosition();
      x = free.x;
      y = free.y;
    }

    const node: IFlowNode = {
      id,
      type: item.type,
      label: this.paletteSimpleMode ? simpleNodeLabel(item.type, item.label) : item.label,
      position: { x, y },
      config: buildDefaultConfig(item),
      supportedChannels: item.supportedChannels as FlowChannel[]
    };
    this.flow.nodes = [...this.flow.nodes, node];
    if (!this.flow.entryNodeId && item.type.startsWith('trigger.')) {
      this.flow.entryNodeId = id;
    }
    this.wireNewNode(node, source, fromDrop);
    if (this.paletteSimpleMode) {
      if (item.type === 'action.send_buttons') this.scaffoldQuestion(node, fromDrop);
      else if (item.type === 'wait.user_reply') this.scaffoldWaitBranches(node);
    }
    this.selectedNodeId = id;
    this.selectedEdgeId = null;
    if (item.type === 'action.send_template') {
      this.ensureWaTemplatesLoaded();
    }
    this.queueSave();
    this.cdr.markForCheck();
  }

  private autoConnectSource(newType: string): IFlowNode | null {
    if (!this.flow || newType.startsWith('trigger.')) return null;
    if (this.selectedNode) return this.selectedNode;
    const sorted = [...this.flow.nodes].sort((a, b) => b.position.y - a.position.y);
    return sorted[0] || null;
  }

  private stackPosition(source: IFlowNode): { x: number; y: number } {
    if (source.type === 'control.end') {
      return { x: source.position.x, y: source.position.y };
    }
    return { x: source.position.x, y: source.position.y + 130 };
  }

  private isBranchingType(type: string): boolean {
    if (type.startsWith('condition.')) return true;
    return [
      'wait.user_reply',
      'control.ab_split',
      'control.random_branch',
      'action.send_buttons',
      'action.send_list',
      'action.offer_slots',
      'action.offer_services',
      'action.book_appointment'
    ].includes(type);
  }

  private wireNewNode(newNode: IFlowNode, source: IFlowNode | null, fromDrop: boolean): void {
    if (!this.flow || !source) return;

    if (source.type === 'control.end') {
      const incoming = this.flow.edges.filter((e) => e.target === source.id);
      const from = incoming[incoming.length - 1];
      if (from) {
        this.flow.edges = this.flow.edges.filter((e) => e.id !== from.id);
        this.pushEdge(from.source, newNode.id, from.label);
      }
      this.pushEdge(newNode.id, source.id);
      if (!fromDrop) {
        source.position = { ...source.position, y: newNode.position.y + 130 };
      }
      return;
    }

    const outgoing = this.flow.edges.filter((e) => e.source === source.id);
    if (!this.isBranchingType(source.type) && outgoing.length === 1) {
      const old = outgoing[0];
      this.flow.edges = this.flow.edges.filter((e) => e.id !== old.id);
      this.pushEdge(source.id, newNode.id, old.label);
      this.pushEdge(newNode.id, old.target);
      if (!fromDrop) {
        const target = this.flow.nodes.find((n) => n.id === old.target);
        if (target && target.position.y <= newNode.position.y) {
          target.position = { ...target.position, y: newNode.position.y + 130 };
        }
      }
      return;
    }

    this.pushEdge(source.id, newNode.id);
  }

  private pushEdge(sourceId: string, targetId: string, label?: string): void {
    if (!this.flow || sourceId === targetId) return;
    if (this.flow.edges.some((e) => e.source === sourceId && e.target === targetId)) return;
    const sourceNode = this.flow.nodes.find((n) => n.id === sourceId);
    const targetNode = this.flow.nodes.find((n) => n.id === targetId);
    const edge: IFlowEdge = {
      id: `e_${sourceId}_${targetId}_${Date.now().toString(36).slice(2, 7)}`,
      source: sourceId,
      target: targetId,
      label: label ?? this.suggestBranchLabel(sourceNode)
    };
    if (sourceNode && targetNode) {
      inheritConfigOnConnect(
        sourceNode,
        targetNode,
        this.catalogItemFor(sourceNode),
        this.catalogItemFor(targetNode)
      );
    }
    this.flow.edges = [...this.flow.edges, edge];
  }

  private appendCatalogNode(type: string, x: number, y: number, configPatch?: Record<string, unknown>): IFlowNode | null {
    if (!this.flow) return null;
    const item = this.catalog.find((c) => c.type === type);
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const node: IFlowNode = {
      id,
      type,
      label: simpleNodeLabel(type, item?.label),
      position: { x, y },
      config: { ...buildDefaultConfig(item), ...(configPatch || {}) },
      supportedChannels: (item?.supportedChannels || []) as FlowChannel[]
    };
    this.flow.nodes = [...this.flow.nodes, node];
    return node;
  }

  /** After "Ask a question", add Wait + They replied / If they don't reply paths. */
  private scaffoldQuestion(buttons: IFlowNode, fromDrop: boolean): void {
    if (!this.flow) return;
    const nextId = this.flow.edges.find((e) => e.source === buttons.id)?.target;
    const next = nextId ? this.flow.nodes.find((n) => n.id === nextId) : null;
    if (next?.type === 'wait.user_reply') {
      this.scaffoldWaitBranches(next);
      return;
    }
    const wait = this.appendCatalogNode(
      'wait.user_reply',
      buttons.position.x,
      buttons.position.y + 130
    );
    if (!wait) return;
    if (nextId) {
      this.flow.edges = this.flow.edges.filter((e) => !(e.source === buttons.id && e.target === nextId));
      this.pushEdge(buttons.id, wait.id);
      this.pushEdge(wait.id, nextId, 'reply');
      if (!fromDrop) {
        const target = this.flow.nodes.find((n) => n.id === nextId);
        if (target && target.position.y <= wait.position.y) {
          target.position = { ...target.position, y: wait.position.y + 130 };
        }
      }
    } else {
      this.pushEdge(buttons.id, wait.id);
    }
    this.scaffoldWaitBranches(wait);
  }

  /** Label the reply path and add an "If they don't reply" reminder if missing. */
  private scaffoldWaitBranches(wait: IFlowNode): void {
    if (!this.flow) return;
    const timeoutLabels = new Set(['no_reply', 'timeout', 'expired']);
    const replyLabels = new Set(['reply', 'replied', 'yes']);
    const outgoing = this.flow.edges.filter((e) => e.source === wait.id);
    const hasTimeout = outgoing.some((e) => timeoutLabels.has(String(e.label || '').toLowerCase()));
    const hasReply = outgoing.some((e) => replyLabels.has(String(e.label || '').toLowerCase()));

    if (!hasReply) {
      const unlabeled = outgoing.find((e) => !e.label);
      if (unlabeled) unlabeled.label = 'reply';
    }

    if (hasTimeout) return;

    const reminder = this.appendCatalogNode(
      'action.send_text',
      wait.position.x + 280,
      wait.position.y,
      { text: "Still there? Reply when you're ready. 😊" }
    );
    if (!reminder) return;
    reminder.label = "If they don't reply";

    const replyTarget = this.flow.edges.find((e) => e.source === wait.id && String(e.label || '').toLowerCase() === 'reply')?.target;
    let end = this.flow.nodes.find(
      (n) => n.type === 'control.end' && n.id !== replyTarget && n.position.x >= wait.position.x
    );
    if (!end) {
      end = this.appendCatalogNode('control.end', reminder.position.x, reminder.position.y + 130) || undefined;
    }
    this.pushEdge(wait.id, reminder.id, 'no_reply');
    if (end) this.pushEdge(reminder.id, end.id);

    const hasReplyNow = this.flow.edges.some(
      (e) => e.source === wait.id && replyLabels.has(String(e.label || '').toLowerCase())
    );
    if (!hasReplyNow) {
      const mainEnd = this.flow.nodes.find((n) => n.type === 'control.end' && n.id !== end?.id);
      const replyTo = mainEnd || end;
      if (replyTo) this.pushEdge(wait.id, replyTo.id, 'reply');
    }
  }

  paletteItemLabel(item: IFlowNodeCatalogItem): string {
    return this.paletteSimpleMode ? simpleNodeLabel(item.type, item.label) : item.label;
  }

  displayNodeKind(type: string): string {
    return simpleNodeLabel(type, this.catalogLabelByType(type));
  }

  edgeDisplayLabel(label?: string | null): string {
    return humanEdgeLabel(label);
  }

  edgeLabelWidth(label?: string | null): number {
    const text = humanEdgeLabel(label) || String(label || '');
    return Math.max(44, Math.min(168, Math.round(text.length * 7.2 + 18)));
  }

  branchPresetLabel(preset: string): string {
    return humanEdgeLabel(preset) || preset;
  }

  // ── Drag from palette → canvas (pointer-based) ─────────────────────────────
  dragOverCanvas = false;

  onPalettePointerDown(item: IFlowNodeCatalogItem, event: PointerEvent): void {
    if (item.comingSoon || event.button !== 0) return;
    event.preventDefault();
    this.palettePress = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false
    };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  private updatePaletteDrag(event: PointerEvent): void {
    const press = this.palettePress;
    if (!press || event.pointerId !== press.pointerId) return;
    const dx = event.clientX - press.startX;
    const dy = event.clientY - press.startY;
    if (!press.dragging && (dx * dx + dy * dy) >= 64) {
      press.dragging = true;
    }
    if (!press.dragging) return;

    this.paletteGhost = {
      x: event.clientX + 12,
      y: event.clientY + 12,
      label: this.paletteItemLabel(press.item)
    };
    const wrap = this.canvasWrap?.nativeElement;
    let over = false;
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      over = event.clientX >= r.left && event.clientX <= r.right
        && event.clientY >= r.top && event.clientY <= r.bottom;
    }
    this.dragOverCanvas = over;
    this.cdr.markForCheck();
  }

  private finishPalettePointer(event: PointerEvent): void {
    const press = this.palettePress;
    this.palettePress = null;
    this.paletteGhost = null;
    this.dragOverCanvas = false;
    if (!press || event.pointerId !== press.pointerId) {
      this.cdr.markForCheck();
      return;
    }
    if (!press.dragging) {
      this.addNodeFromCatalog(press.item);
      return;
    }
    const wrap = this.canvasWrap?.nativeElement;
    if (!wrap) {
      this.cdr.markForCheck();
      return;
    }
    const r = wrap.getBoundingClientRect();
    const over = event.clientX >= r.left && event.clientX <= r.right
      && event.clientY >= r.top && event.clientY <= r.bottom;
    if (!over) {
      this.cdr.markForCheck();
      return;
    }
    const canvasEl = wrap.querySelector('.fb-canvas');
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect) {
      this.addNodeFromCatalog(press.item);
      return;
    }
    const x = (event.clientX - rect.left) / this.zoom - 110;
    const y = (event.clientY - rect.top) / this.zoom - 28;
    this.createNodeAt(press.item, x, y);
  }

  /** Category key used to colour-code nodes and palette chips. */
  nodeCategoryOf(type: string): NodeCategory {
    return (type.split('.')[0] as NodeCategory) || 'action';
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.selectedEdgeId = null;
    if (this.inspectorCollapsed) {
      this.inspectorCollapsed = false;
      this.focusMode = false;
    }
    this.ensureNodeConfig(this.selectedNode);
    if (this.selectedNode?.type === 'action.send_template') {
      this.ensureWaTemplatesLoaded();
    }
    this.refreshSelectedNodeFieldDefs();
    this.cdr.markForCheck();
  }

  /**
   * Build (or rebuild) the pre-computed field-descriptor array for the currently
   * selected node.  This is the single most impactful perf fix: instead of
   * calling catalog.find() + getConfigFieldDef() dozens of times per Angular
   * change-detection cycle (every keystroke!), we do it once on selection change
   * and cache the result.
   */
  private refreshSelectedNodeFieldDefs(): void {
    const node = this.selectedNode;
    const catalogItem = node ? this.catalogItemFor(node) : undefined;
    if (!node || !catalogItem?.configFields?.length) {
      this.selectedNodeFieldDefs = [];
      return;
    }
    this.selectedNodeFieldDefs = catalogItem.configFields.map(f => {
      const isWaTemplatePicker = node.type === 'action.send_template' && f.key === 'templateId';
      const isPlainString = !isWaTemplatePicker &&
        !FlowBuilderComponent.NON_STRING_FIELD_TYPES.has(f.type ?? 'string');
      return {
        key: f.key,
        label: (f as any).label ?? f.key,
        type: f.type ?? 'string',
        hint: (f as any).hint ?? '',
        options: Array.isArray((f as any).options) ? (f as any).options : [],
        isWaTemplatePicker,
        isPlainString
      };
    });
  }

  trackByFieldKey(_: number, fd: { key: string }): string { return fd.key; }
  trackByNodeId(_: number, n: IFlowNode): string { return n.id; }
  trackByEdgeId(_: number, e: IFlowEdge): string { return e.id; }
  trackByIndex(i: number): number { return i; }
  trackByTemplateId(_: number, t: WhatsAppTemplate): string {
    return String(t._id ?? t.metaTemplateId ?? t.name ?? '');
  }

  loadWaConnections(): void {
    this.platformConnectionService.getConnections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.allConnections = (res.data || []).filter((c) => c.status === 'connected' && c.isActive);
          this.waConnections = this.allConnections.filter((c) => c.platform === 'whatsapp');
          if (!this.waConnectionId && this.waConnections.length) {
            this.waConnectionId = this.waConnections[0]._id;
            this.loadWaTemplates();
          }
          this.refreshDisconnectedChannels();
          this.cdr.markForCheck();
        },
        error: () => {
          this.waConnections = [];
          this.allConnections = [];
          this.cdr.markForCheck();
        }
      });
  }

  /** Recompute which of the flow's channels have no active platform connection. */
  private refreshDisconnectedChannels(): void {
    const channels = this.flow?.channels ?? [];
    const connectedPlatforms = new Set(this.allConnections.map((c) => c.platform));
    this.disconnectedChannels = channels.filter((ch) => !connectedPlatforms.has(ch));
  }

  disconnectedChannelNames(): string {
    return this.disconnectedChannels.map((ch) => this.channelDisplayLabel(ch)).join(' & ');
  }

  private loadAutomationMode(): void {
    if (!this.orgId) return;
    this.orgService.getOrganization(this.orgId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          const modes = r.data?.automationModeByChannel;
          if (modes) {
            this.automationModeByChannel = {
              whatsapp: modes.whatsapp ?? 'hybrid',
              instagram: modes.instagram ?? 'hybrid',
              facebook: modes.facebook ?? 'hybrid'
            };
            this.cdr.markForCheck();
          }
        }
      });
  }

  /** True when every channel on this flow is AI-only — auto-replies will never fire. */
  get flowCannotFire(): boolean {
    const channels = (this.flow?.channels ?? []) as AutomationChannel[];
    if (!channels.length) return false;
    return channels.every((ch) => (this.automationModeByChannel[ch] ?? 'hybrid') === 'ai_only');
  }

  addStarterTrigger(triggerType: string): void {
    if (!triggerType || !this.flow) return;
    if (this.flow.nodes.length === 0) {
      const stamp = stampByTriggerType(triggerType);
      if (stamp) {
        this.applyStampedFlow(stamp);
        return;
      }
    }
    const match = this.catalog.find((c) => c.type === triggerType);
    if (match) this.addNodeFromCatalog(match);
  }

  setPaletteSimple(simple: boolean): void {
    this.paletteSimpleMode = simple;
    this.cdr.markForCheck();
  }

  onCatalogFilterChange(): void {
    this.cdr.markForCheck();
  }

  private applyStampedFlow(stamp: IStampedFlow): void {
    if (!this.flow) return;
    this.flow.nodes = JSON.parse(JSON.stringify(stamp.nodes));
    this.flow.edges = JSON.parse(JSON.stringify(stamp.edges));
    this.flow.entryNodeId = stamp.entryNodeId;
    for (const ch of stamp.channels) {
      if (!this.flow.channels.includes(ch)) {
        this.flow.channels = [...this.flow.channels, ch];
      }
    }
    if (!this.flow.name || /^untitled$/i.test(this.flow.name.trim())) {
      this.flow.name = stamp.name;
    }
    const firstAction = stamp.nodes.find((n) => n.type.startsWith('action.'));
    this.selectedNodeId = firstAction?.id ?? stamp.entryNodeId;
    this.selectedEdgeId = null;
    this.ensureNodeConfig(this.selectedNode);
    this.refreshSelectedNodeFieldDefs();
    this.queueSave();
    this.cdr.markForCheck();
    requestAnimationFrame(() => this.fitView());
  }

  /** Returns the human-readable label for a node type from the catalog. */
  catalogLabelByType(nodeType: string): string {
    return this.catalog.find((c) => c.type === nodeType)?.label || nodeType;
  }

  onWaConnectionChange(connectionId: string): void {
    this.waConnectionId = connectionId;
    this.loadWaTemplates();
  }

  ensureWaTemplatesLoaded(): void {
    if (!this.waConnectionId && this.waConnections.length) {
      this.waConnectionId = this.waConnections[0]._id;
    }
    if (this.waConnectionId && !this.waTemplates.length && !this.waTemplatesLoading) {
      this.loadWaTemplates();
    }
  }

  loadWaTemplates(): void {
    if (!this.waConnectionId) {
      this.waTemplates = [];
      this.waTemplatesError = this.waConnections.length
        ? 'Select a WhatsApp connection.'
        : 'Connect WhatsApp to load templates.';
      this.cdr.markForCheck();
      return;
    }

    this.waTemplatesLoading = true;
    this.waTemplatesError = '';
    this.whatsAppTemplateService.listTemplates(this.waConnectionId)
      .pipe(takeUntil(this.destroy$), finalize(() => {
        this.waTemplatesLoading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (res) => {
          this.waTemplates = (res.templates || []).slice().sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          if (!this.waTemplates.length) {
            this.waTemplatesError = 'No templates found. Create templates under WhatsApp Templates.';
          }
        },
        error: (err) => {
          this.waTemplates = [];
          this.waTemplatesError = err?.error?.error || 'Could not load WhatsApp templates.';
        }
      });
  }

  templateOptionValue(t: WhatsAppTemplate): string {
    return String(t._id || t.metaTemplateId || t.id || t.name);
  }

  templateOptionLabel(t: WhatsAppTemplate): string {
    const status = String(t.status || '').toUpperCase();
    const statusSuffix = status && status !== 'APPROVED' ? ` · ${status}` : '';
    return `${t.name} · ${t.category} · ${t.language}${statusSuffix}`;
  }

  templateBodyPreview(t: WhatsAppTemplate): string {
    return t.components?.find((c) => c.type === 'BODY')?.text || '';
  }

  onTemplateSelect(node: IFlowNode, templateId: string): void {
    if (!node.config) node.config = {};
    node.config['templateId'] = templateId;
    const picked = this.waTemplates.find((t) => this.templateOptionValue(t) === templateId);
    if (picked) {
      node.config['templateName'] = picked.name;
      node.config['templateLanguage'] = picked.language;
    }
    this.onNodeFieldChange();
  }

  // ── Media picker ──────────────────────────────────────────────────────────

  showMediaPicker = false;
  /** Stack above `.fb-editor` (z-index 9998) so library/upload modals are not hidden. */
  readonly mediaPickerOverlayZIndex = 10000;

  /** Node + key that triggered the media picker, so we know where to write the URL back. */
  mediaPickerTarget: { node: IFlowNode; key: string } | null = null;

  /** Map from WA media type to the filter the media library understands. */
  private static readonly WA_TO_LIB_TYPE: Record<string, 'image' | 'video' | 'audio' | 'file' | 'all'> = {
    image: 'image',
    video: 'video',
    audio: 'audio',
    document: 'file',
    sticker: 'image'
  };

  /** Opens the media selector for the node's current mediaType filter. */
  openMediaPicker(node: IFlowNode, key: string): void {
    this.mediaPickerTarget = { node, key };
    this.showMediaPicker = true;
    this.cdr.markForCheck();
  }

  closeMediaPicker(): void {
    this.showMediaPicker = false;
    this.mediaPickerTarget = null;
    this.cdr.markForCheck();
  }

  onMediaSelected(media: Media): void {
    if (!this.mediaPickerTarget) return;
    const { node, key } = this.mediaPickerTarget;
    if (!node.config) node.config = {};
    node.config[key] = media.publicUrl;
    // Auto-fill filename for documents
    if (node.config['mediaType'] === 'document' && !node.config['filename']) {
      node.config['filename'] = media.originalName || media.filename || '';
    }
    this.onNodeFieldChange();
    this.closeMediaPicker();
  }

  /** Returns the media library type filter for the currently selected WA media type. */
  mediaLibraryFilter(node: IFlowNode): 'image' | 'video' | 'audio' | 'file' | 'all' {
    const waType = String(node.config?.['mediaType'] || 'image');
    return FlowBuilderComponent.WA_TO_LIB_TYPE[waType] ?? 'all';
  }

  /** True when the mediaUrl field has a value that looks like an image we can preview. */
  isPreviewableImage(node: IFlowNode, key: string): boolean {
    const url = String(node.config?.[key] || '');
    const type = String(node.config?.['mediaType'] || '');
    return !!url && (type === 'image' || type === 'sticker');
  }

  clearMediaUrl(node: IFlowNode, key: string): void {
    if (!node.config) return;
    node.config[key] = '';
    this.onNodeFieldChange();
  }

  showWaTemplatePicker(node: IFlowNode, key: string): boolean {
    return node.type === 'action.send_template' && key === 'templateId';
  }

  /** Field types that render with their own dedicated editor (not the plain text input). */
  private static readonly NON_STRING_FIELD_TYPES = new Set([
    'string[]', 'select', 'number', 'textarea', 'json', 'node', 'bucket',
    'product', 'template', 'reply_buttons', 'list_sections', 'product_sections',
    'media_url',
    // Appointment / entity pickers — each has a dedicated <select> in the template;
    // without these the raw MongoDB ID renders as a plain string input below the picker.
    'service', 'provider', 'wa_template'
  ]);

  /** True when the field should fall back to a plain text input. */
  isPlainStringField(node: IFlowNode, key: string): boolean {
    if (this.showWaTemplatePicker(node, key)) return false;
    return !FlowBuilderComponent.NON_STRING_FIELD_TYPES.has(this.getConfigFieldType(node, key));
  }

  get showWaConnectionSelector(): boolean {
    return this.waConnections.length > 1;
  }

  catalogItemFor(node: IFlowNode | null): IFlowNodeCatalogItem | undefined {
    if (!node) return undefined;
    return this.catalog.find((c) => c.type === node.type);
  }

  /** Resolve a node ID to its human-readable label for display in the edge inspector. */
  nodeLabelById(nodeId: string): string {
    const node = this.flow?.nodes?.find((n: IFlowNode) => n.id === nodeId);
    return node?.label || nodeId;
  }

  private static readonly CHANNEL_LABELS: Record<string, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    facebook: 'Facebook'
  };

  private static readonly CHANNEL_ICONS: Record<string, string> = {
    whatsapp: 'fab fa-whatsapp',
    instagram: 'fab fa-instagram',
    facebook: 'fab fa-facebook-f'
  };

  /** Proper brand-capitalised display name for a channel enum value. */
  channelDisplayLabel(ch: string): string {
    return FlowBuilderComponent.CHANNEL_LABELS[ch] ?? ch.charAt(0).toUpperCase() + ch.slice(1);
  }

  /** Font-Awesome icon class for a channel. */
  channelIcon(ch: string): string {
    return FlowBuilderComponent.CHANNEL_ICONS[ch] ?? 'fas fa-comment';
  }

  private ensureNodeConfig(node: IFlowNode | null): void {
    if (!node) return;
    ensureNodeConfigKeys(node, this.catalogItemFor(node));
  }

  get previewChannel(): FlowChannel {
    const node = this.selectedNode;
    const channels = this.flow?.channels ?? ['whatsapp'];
    if (node && (
      node.type.includes('.ig_')
      || node.type.includes('instagram')
      || INSTAGRAM_NODE_TYPES.has(node.type)
    )) {
      return 'instagram';
    }
    if (channels.includes('whatsapp')) return 'whatsapp';
    return (channels[0] as FlowChannel) || 'whatsapp';
  }

  get previewHeaderName(): string {
    const name = (this.flow?.name || '').trim();
    if (name && !/^untitled$/i.test(name)) return name;
    if (this.previewChannel === 'instagram') return 'your.shop';
    if (this.previewChannel === 'facebook') return 'Your Page';
    return 'Your shop';
  }

  get previewAvatarLetter(): string {
    const ch = this.previewHeaderName.trim().charAt(0);
    return (ch || 'S').toUpperCase();
  }

  get previewHeaderSub(): string {
    return this.previewChannel === 'whatsapp' ? 'online' : 'Active now';
  }

  get previewComposerPlaceholder(): string {
    if (this.previewChannel === 'facebook') return 'Aa';
    return 'Message';
  }

  get chatPreview(): {
    inbound?: string;
    outbound?: string;
    mediaUrl?: string;
    buttons?: string[];
    status?: string;
  } {
    const node = this.selectedNode;
    if (!node) return {};
    const cfg = node.config || {};
    const inbound = this.sampleInboundText(node);
    const t = node.type;

    if (t.startsWith('trigger.')) {
      return { inbound, status: 'This starts the flow' };
    }
    if (t === 'wait.user_reply') {
      return { inbound, status: 'Waiting for their reply…' };
    }
    if (t === 'wait.delay' || t === 'wait.human_delay') {
      return { status: 'Waiting a moment…' };
    }
    if (t === 'control.end') {
      return { status: 'Done — this flow stops here' };
    }
    if (t === 'action.escalate_human') {
      return { inbound, status: 'A teammate will continue this chat' };
    }
    if (t === 'action.send_text' || t === 'action.reply_public_comment') {
      return { inbound, outbound: fillPreviewVars(cfg['text']) || 'Type a message below' };
    }
    if (t === 'action.send_media') {
      const caption = fillPreviewVars(cfg['caption']);
      const url = String(cfg['mediaUrl'] || '');
      const image = this.isPreviewableImage(node, 'mediaUrl') ? url : '';
      return {
        inbound,
        outbound: caption || (image ? '' : 'Pick a photo below'),
        mediaUrl: image || undefined
      };
    }
    if (t === 'action.send_buttons') {
      const buttons = this.getReplyButtons(node, 'buttons').map((b) => b.title).filter(Boolean);
      return {
        inbound,
        outbound: fillPreviewVars(cfg['bodyText']) || 'Type the question below',
        buttons: buttons.length ? buttons : ['Yes', 'No']
      };
    }
    if (t === 'action.send_list') {
      return {
        inbound,
        outbound: fillPreviewVars(cfg['bodyText']),
        buttons: [String(cfg['buttonText'] || 'View options')]
      };
    }
    if (t === 'action.send_generic_template') {
      const title = fillPreviewVars(cfg['title']);
      const subtitle = fillPreviewVars(cfg['subtitle']);
      const labels = this.getButtons(node, 'buttons').map((b) => b.label).filter(Boolean);
      return {
        inbound,
        outbound: [title, subtitle].filter(Boolean).join('\n') || 'Card preview',
        mediaUrl: String(cfg['imageUrl'] || '') || undefined,
        buttons: labels
      };
    }
    if (t === 'action.send_template') {
      return { inbound, outbound: fillPreviewVars(this.previewMessage) || 'Pick a WhatsApp template' };
    }
    const fallback = fillPreviewVars(this.previewMessage);
    if (fallback) return { inbound, outbound: fallback };
    return { inbound, status: this.displayNodeKind(t) };
  }

  private sampleInboundText(selected?: IFlowNode | null): string {
    const trigger = selected?.type.startsWith('trigger.')
      ? selected
      : this.flow?.nodes.find((n) => n.type.startsWith('trigger.'));
    if (!trigger) return 'Hi';
    const keywords = trigger.config?.['keywords'];
    const word = Array.isArray(keywords) && keywords[0] ? String(keywords[0]) : '';
    if (trigger.type === 'trigger.ig_comment') return word ? `${word}?` : 'What’s the price?';
    if (trigger.type === 'trigger.keyword') return word || 'price';
    if (trigger.type === 'trigger.first_message') return 'Hi';
    if (trigger.type === 'trigger.ig_dm') return 'Hi';
    return 'Hi';
  }

  get previewMessage(): string | null {
    const node = this.selectedNode;
    if (!node) return null;
    const cfg = node.config || {};
    if (node.type === 'action.send_text') return String(cfg['text'] || '');
    if (node.type === 'action.send_generic_template') {
      const title = cfg['title'] || '';
      const subtitle = cfg['subtitle'] || '';
      return [title, subtitle].filter(Boolean).join('\n') || null;
    }
    if (node.type === 'action.send_template') {
      const name = cfg['templateName'] || this.waTemplates.find(
        (t) => this.templateOptionValue(t) === String(cfg['templateId'] || '')
      )?.name;
      if (name) {
        const body = this.waTemplates.find((t) => t.name === name);
        const preview = body ? this.templateBodyPreview(body) : '';
        return preview || `Template: ${name}`;
      }
      return 'Select a WhatsApp template';
    }
    if (node.type === 'action.reply_public_comment') return String(cfg['text'] || '');
    return null;
  }

  startConnect(nodeId: string, event: Event): void {
    event.stopPropagation();
    this.connectingFrom = this.connectingFrom === nodeId ? null : nodeId;
    this.cdr.markForCheck();
  }

  /** Auto-label a new edge leaving a branching node (first=yes/reply, second=no/no_reply). */
  private suggestBranchLabel(sourceNode?: IFlowNode): string {
    if (!sourceNode || !this.flow) return '';
    const existing = this.flow.edges.filter((e) => e.source === sourceNode.id);
    const used = new Set(existing.map((e) => e.label).filter(Boolean));
    if (sourceNode.type === 'action.send_buttons') {
      const buttons = Array.isArray(sourceNode.config?.['buttons'])
        ? (sourceNode.config['buttons'] as Array<{ id?: string }>)
        : [];
      const next = buttons.find((b) => b.id && !used.has(b.id));
      return next?.id || '';
    }
    if (sourceNode.type.startsWith('condition.')) return existing.length === 0 ? 'yes' : existing.length === 1 ? 'no' : '';
    if (sourceNode.type === 'wait.user_reply') return existing.length === 0 ? 'reply' : existing.length === 1 ? 'no_reply' : '';
    if (sourceNode.type === 'control.ab_split') return existing.length === 0 ? 'A' : existing.length === 1 ? 'B' : '';
    return '';
  }

  completeConnect(targetId: string, event: Event): void {
    event.stopPropagation();
    if (!this.flow || !this.connectingFrom || this.connectingFrom === targetId) {
      this.connectingFrom = null;
      return;
    }
    const edgeId = `edge_${Date.now()}`;
    const sourceNode = this.flow.nodes.find((n) => n.id === this.connectingFrom);
    const targetNode = this.flow.nodes.find((n) => n.id === targetId);
    const edge: IFlowEdge = {
      id: edgeId,
      source: this.connectingFrom,
      target: targetId,
      label: this.suggestBranchLabel(sourceNode)
    };
    if (sourceNode && targetNode) {
      inheritConfigOnConnect(
        sourceNode,
        targetNode,
        this.catalogItemFor(sourceNode),
        this.catalogItemFor(targetNode)
      );
    }
    this.flow.edges = [...this.flow.edges, edge];
    this.connectingFrom = null;
    this.queueSave();
    this.cdr.markForCheck();
  }

  deleteSelectedNode(): void {
    if (!this.flow || !this.selectedNodeId) return;
    const id = this.selectedNodeId;
    const node = this.flow.nodes.find((n: IFlowNode) => n.id === id);
    const connectedEdges = this.flow.edges.filter((e: IFlowEdge) => e.source === id || e.target === id).length;
    const edgeNote = connectedEdges > 0
      ? ` This will also remove ${connectedEdges} connected edge${connectedEdges > 1 ? 's' : ''}.`
      : '';
    this.swal.confirmDelete(
      `Delete "${node?.label || 'node'}"?`,
      `Press Ctrl+Z to undo.${edgeNote}`
    ).then((result) => {
      if (!result.isConfirmed || !this.flow) return;
      const removedEdges = this.flow.edges.filter((e: IFlowEdge) => e.source === id || e.target === id);
      this._pushUndo({ type: 'node_delete', nodes: [node!], edges: removedEdges });
      this.flow.nodes = this.flow.nodes.filter((n: IFlowNode) => n.id !== id);
      this.flow.edges = this.flow.edges.filter((e: IFlowEdge) => e.source !== id && e.target !== id);
      this.selectedNodeId = null;
      this.selectedNodeFieldDefs = [];
      this.queueSave();
      this.cdr.markForCheck();
    });
  }

  // ── Undo stack ─────────────────────────────────────────────────────────────
  private _pushUndo(entry: { type: 'node_delete' | 'edge_delete'; nodes: IFlowNode[]; edges: IFlowEdge[] }): void {
    this._undoStack.push(entry);
    if (this._undoStack.length > this._maxUndo) this._undoStack.shift();
  }

  undoLastDelete(): void {
    const entry = this._undoStack.pop();
    if (!entry || !this.flow) return;
    entry.nodes.forEach((n) => {
      if (!this.flow!.nodes.some((x) => x.id === n.id)) this.flow!.nodes.push(n);
    });
    entry.edges.forEach((e) => {
      if (!this.flow!.edges.some((x) => x.id === e.id)) this.flow!.edges.push(e);
    });
    this.queueSave();
    this.notify.success('Undone', `Restored ${entry.nodes.length > 0 ? 'node and its edges' : 'edge'}.`);
    this.cdr.markForCheck();
  }

  onNodeFieldChange(): void {
    this.queueSave();
    this.cdr.markForCheck();
  }

  nodeCategory(type: string): string {
    return type.split('.')[0];
  }

  nodeIcon(type: string): string {
    return this.catalog.find((c) => c.type === type)?.icon || 'fas fa-circle';
  }

  edgePath(edge: IFlowEdge): string {
    const src = this.flow?.nodes.find((n) => n.id === edge.source);
    const tgt = this.flow?.nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) return '';
    const x1 = src.position.x + 110;
    const y1 = src.position.y + 36;
    const x2 = tgt.position.x + 10;
    const y2 = tgt.position.y + 36;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  onNodePointerDown(node: IFlowNode, event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('.fb-node__connect')) return;
    this.dragNode = node;
    this.dragStart = { x: event.clientX, y: event.clientY, nx: node.position.x, ny: node.position.y };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.palettePress) {
      this.updatePaletteDrag(event);
      return;
    }
    // Skip immediately when no interaction is active — avoids ANY overhead on plain mouse movement.
    if (!this.dragNode && !this.panning) return;

    // Buffer the latest event and schedule a single rAF flush.
    // This caps Angular change detection to one cycle per display frame (~16 ms)
    // instead of firing on every raw mousemove event (up to 250/s on some devices).
    this._pendingPointerEvent = event;
    if (this._rafId !== null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      const ev = this._pendingPointerEvent;
      this._pendingPointerEvent = null;
      if (!ev) return;

      if (this.dragNode && this.flow) {
        const dx = (ev.clientX - this.dragStart.x) / this.zoom;
        const dy = (ev.clientY - this.dragStart.y) / this.zoom;
        this.dragNode.position = {
          x: Math.max(0, this.dragStart.nx + dx),
          y: Math.max(0, this.dragStart.ny + dy)
        };
        this.cdr.markForCheck();
        return;
      }
      if (this.panning) {
        this.canvasOffset = {
          x: this.panStart.ox + (ev.clientX - this.panStart.x),
          y: this.panStart.oy + (ev.clientY - this.panStart.y)
        };
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (this.palettePress) {
      this.finishPalettePointer(event);
      return;
    }
    if (this.dragNode) {
      this.dragNode = null;
      this.queueSave();
    }
    if (this.panning) {
      this.panning = false;
      this.cdr.markForCheck();
    }
  }

  /** Keyboard: Delete removes selection, Esc cancels connect / clears selection. */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      this.undoLastDelete();
      event.preventDefault();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedEdgeId) { this.deleteSelectedEdge(); event.preventDefault(); }
      else if (this.selectedNodeId) { this.deleteSelectedNode(); event.preventDefault(); }
    } else if (event.key === 'Escape') {
      this.connectingFrom = null;
      this.selectedEdgeId = null;
      this.palettePress = null;
      this.paletteGhost = null;
      this.dragOverCanvas = false;
      this.closePanels();
      this.cdr.markForCheck();
    } else if (event.key === '[' && !event.metaKey && !event.ctrlKey) {
      this.togglePalette();
      event.preventDefault();
    } else if (event.key === ']' && !event.metaKey && !event.ctrlKey) {
      this.toggleInspector();
      event.preventDefault();
    } else if (event.key === 'f' && !event.metaKey && !event.ctrlKey) {
      this.toggleFocusMode();
      event.preventDefault();
    } else if (event.key === '0' && !event.metaKey && !event.ctrlKey) {
      this.fitView();
      event.preventDefault();
    }
  }

  // ── Edge selection / labelling / deletion ──────────────────────────────────
  get selectedEdge(): IFlowEdge | null {
    return this.flow?.edges.find((e) => e.id === this.selectedEdgeId) ?? null;
  }

  selectEdge(id: string, event: Event): void {
    event.stopPropagation();
    this.selectedEdgeId = id;
    this.selectedNodeId = null;
    if (this.inspectorCollapsed) {
      this.inspectorCollapsed = false;
      this.focusMode = false;
    }
    this.cdr.markForCheck();
  }

  /** True when the edge starts at a branching node (condition / wait-for-reply). */
  edgeIsBranching(edge: IFlowEdge | null): boolean {
    if (!edge) return false;
    const src = this.flow?.nodes.find((n) => n.id === edge.source);
    return !!src && (src.type.startsWith('condition.') || src.type === 'wait.user_reply'
      || src.type === 'control.ab_split' || src.type === 'control.random_branch');
  }

  setEdgeLabel(edge: IFlowEdge, label: string): void {
    edge.label = label;
    this.queueSave();
    this.cdr.markForCheck();
  }

  deleteSelectedEdge(): void {
    if (!this.flow || !this.selectedEdgeId) return;
    const edge = this.flow.edges.find((e) => e.id === this.selectedEdgeId);
    if (edge) this._pushUndo({ type: 'edge_delete', nodes: [], edges: [edge] });
    this.flow.edges = this.flow.edges.filter((e) => e.id !== this.selectedEdgeId);
    this.selectedEdgeId = null;
    this.queueSave();
    this.cdr.markForCheck();
  }

  edgeLabelPoint(edge: IFlowEdge): { x: number; y: number } | null {
    const src = this.flow?.nodes.find((n) => n.id === edge.source);
    const tgt = this.flow?.nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) return null;
    return { x: (src.position.x + 110 + tgt.position.x + 10) / 2, y: (src.position.y + 36 + tgt.position.y + 36) / 2 };
  }

  // ── Node duplication ───────────────────────────────────────────────────────
  duplicateSelectedNode(): void {
    if (!this.flow || !this.selectedNode) return;
    const src = this.selectedNode;
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const copy: IFlowNode = {
      id,
      type: src.type,
      label: src.label ? `${src.label} (copy)` : src.label,
      position: this.findFreePosition(),
      config: JSON.parse(JSON.stringify(src.config || {})),
      supportedChannels: src.supportedChannels
    };
    this.flow.nodes = [...this.flow.nodes, copy];
    this.selectedNodeId = id;
    this.refreshSelectedNodeFieldDefs();
    this.queueSave();
    this.cdr.markForCheck();
  }

  // ── Inspector picker options ───────────────────────────────────────────────
  nodePickerOptions(currentNodeId: string): Array<{ id: string; label: string }> {
    return (this.flow?.nodes || [])
      .filter((n) => n.id !== currentNodeId)
      .map((n) => ({ id: n.id, label: n.label || n.type }));
  }

  bucketOptions(): Array<{ _id: string; name: string }> {
    return this.intentBuckets;
  }

  productOptions(): Array<{ _id: string; name: string }> {
    return this.products;
  }

  setConfigValue(node: IFlowNode, key: string, value: unknown): void {
    if (!node.config) node.config = {};
    node.config[key] = value;
    this.onNodeFieldChange();
  }

  isDurationConfigField(key: string): boolean {
    return isDurationField(key);
  }

  durationFieldLabel(key: string, fallback: string): string {
    switch (key) {
      case 'delaySec':
        return 'Wait';
      case 'timeoutSec':
        return 'Give up after';
      case 'minSec':
        return 'Wait at least';
      case 'maxSec':
        return 'Wait at most';
      default:
        return fallback.replace(/\s*\(seconds\)\s*/i, '').trim() || fallback;
    }
  }

  private durationCacheKey(node: IFlowNode, key: string): string {
    return `${node.id}:${key}`;
  }

  getDurationUnit(node: IFlowNode, key: string): DurationUnit {
    const cacheKey = this.durationCacheKey(node, key);
    const cached = this.durationUnitByField.get(cacheKey);
    if (cached) return cached;
    const unit = inferDurationUnit(Number(node.config?.[key]) || 0);
    this.durationUnitByField.set(cacheKey, unit);
    return unit;
  }

  getDurationAmount(node: IFlowNode, key: string): number {
    return secondsToAmount(Number(node.config?.[key]) || 0, this.getDurationUnit(node, key));
  }

  setDurationAmount(node: IFlowNode, key: string, amount: number | string): void {
    const unit = this.getDurationUnit(node, key);
    this.setConfigValue(node, key, durationToSeconds(Number(amount), unit));
  }

  setDurationUnit(node: IFlowNode, key: string, unit: DurationUnit): void {
    const amount = this.getDurationAmount(node, key);
    this.durationUnitByField.set(this.durationCacheKey(node, key), unit);
    this.setConfigValue(node, key, durationToSeconds(amount, unit));
  }

  /** Per-node enable/disable (skipped at runtime when disabled). */
  isNodeDisabled(node: IFlowNode): boolean {
    return node.config?.['__disabled'] === true;
  }

  toggleNodeDisabled(node: IFlowNode): void {
    if (!node.config) node.config = {};
    node.config['__disabled'] = !this.isNodeDisabled(node);
    this.onNodeFieldChange();
  }

  toggleChannel(ch: FlowChannel): void {
    if (!this.flow) return;
    const set = new Set(this.flow.channels);
    if (set.has(ch)) set.delete(ch);
    else set.add(ch);
    this.flow.channels = Array.from(set) as FlowChannel[];
    if (!this.flow.channels.length) this.flow.channels = [ch];
    this.refreshDisconnectedChannels();
    this.queueSave();
    this.cdr.markForCheck();
  }

  configKeys(node: IFlowNode): string[] {
    const def = this.catalog.find((c) => c.type === node.type);
    return (def?.configFields || []).map((f) => f.key);
  }

  getConfigFieldLabel(node: IFlowNode, key: string): string {
    return getConfigFieldDef(this.catalogItemFor(node), key)?.label || key;
  }

  getConfigFieldType(node: IFlowNode, key: string): string {
    return getConfigFieldDef(this.catalogItemFor(node), key)?.type || 'string';
  }

  getConfigFieldHint(node: IFlowNode, key: string): string {
    return getConfigFieldDef(this.catalogItemFor(node), key)?.hint || '';
  }

  getConfigFieldOptions(node: IFlowNode, key: string): string[] {
    return getConfigFieldDef(this.catalogItemFor(node), key)?.options || [];
  }

  getStringArrayDisplay(node: IFlowNode, key: string): string {
    return formatStringArray(node.config?.[key]);
  }

  setStringArrayDisplay(node: IFlowNode, key: string, value: string): void {
    if (!node.config) node.config = {};
    node.config[key] = parseStringArray(value);
    this.onNodeFieldChange();
  }

  getJsonDisplay(node: IFlowNode, key: string): string {
    return formatJsonField(node.config?.[key]);
  }

  setJsonDisplay(node: IFlowNode, key: string, value: string): void {
    if (!node.config) node.config = {};
    node.config[key] = parseJsonField(value);
    this.onNodeFieldChange();
  }

  // ── Visual field editors ───────────────────────────────────────────────────

  /** Return string[] config value, always as an array. */
  getStringArray(node: IFlowNode, key: string): string[] {
    const v = node.config?.[key];
    return Array.isArray(v) ? v : [];
  }

  addStringArrayItem(node: IFlowNode, key: string, input: HTMLInputElement): void {
    const val = input.value.trim();
    if (!val) return;
    if (!node.config) node.config = {};
    const arr = this.getStringArray(node, key);
    if (!arr.includes(val)) {
      node.config[key] = [...arr, val];
      this.onNodeFieldChange();
    }
    input.value = '';
  }

  addStringArrayOnEnter(node: IFlowNode, key: string, input: HTMLInputElement, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addStringArrayItem(node, key, input);
    }
  }

  removeStringArrayItem(node: IFlowNode, key: string, index: number): void {
    if (!node.config) return;
    const arr = this.getStringArray(node, key);
    node.config[key] = arr.filter((_, i) => i !== index);
    this.onNodeFieldChange();
  }

  /** Detect if a json field holds a buttons array (array of objects with label). */
  isButtonsArray(node: IFlowNode, key: string): boolean {
    if (key !== 'buttons') return false;
    const v = node.config?.[key];
    return Array.isArray(v) || v == null;
  }

  /** Detect if a json field holds a key-value object (not a buttons array). */
  isKvObject(node: IFlowNode, key: string): boolean {
    if (key === 'buttons') return false;
    const v = node.config?.[key];
    if (v == null || v === '') return true;
    return typeof v === 'object' && !Array.isArray(v);
  }

  // ── Buttons array helpers ─────────────────────────────────────────────────

  getButtons(node: IFlowNode, key: string): Array<{ label: string; type: string; payload?: string; url?: string }> {
    const v = node.config?.[key];
    if (!Array.isArray(v)) return [];
    return v as Array<{ label: string; type: string; payload?: string; url?: string }>;
  }

  addButton(node: IFlowNode, key: string): void {
    if (!node.config) node.config = {};
    const btns = [...this.getButtons(node, key), { label: 'Button', type: 'postback', payload: '' }];
    node.config[key] = btns;
    this.onNodeFieldChange();
  }

  removeButton(node: IFlowNode, key: string, index: number): void {
    if (!node.config) return;
    node.config[key] = this.getButtons(node, key).filter((_, i) => i !== index);
    this.onNodeFieldChange();
  }

  setButtonField(node: IFlowNode, key: string, index: number, field: string, value: string): void {
    if (!node.config) node.config = {};
    const btns = this.getButtons(node, key).map((b, i) => i === index ? { ...b, [field]: value } : b);
    // When switching to web_url, ensure url key exists; when switching to postback, ensure payload exists
    if (field === 'type') {
      btns[index] = value === 'web_url'
        ? { label: btns[index].label, type: 'web_url', url: btns[index].url || '' }
        : { label: btns[index].label, type: 'postback', payload: btns[index].payload || '' };
    }
    node.config[key] = btns;
    this.onNodeFieldChange();
  }

  insertLinkButton(node: IFlowNode, key: string): void {
    if (!node.config) node.config = {};
    const btns = [...this.getButtons(node, key), { label: 'Visit Link', type: 'web_url', url: 'https://' }];
    node.config[key] = btns;
    this.onNodeFieldChange();
  }

  insertPostbackButton(node: IFlowNode, key: string): void {
    if (!node.config) node.config = {};
    const btns = [...this.getButtons(node, key), { label: 'Quick Reply', type: 'postback', payload: '' }];
    node.config[key] = btns;
    this.onNodeFieldChange();
  }

  // ── Key-value object helpers ───────────────────────────────────────────────

  getKvPairs(node: IFlowNode, key: string): Array<{ k: string; v: string }> {
    const obj = node.config?.[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.entries(obj as Record<string, unknown>).map(([k, v]) => ({
      k,
      v: typeof v === 'string' ? v : JSON.stringify(v)
    }));
  }

  addKvPair(node: IFlowNode, key: string): void {
    if (!node.config) node.config = {};
    const obj = { ...(node.config[key] as Record<string, string> || {}) };
    let placeholder = `key_${Object.keys(obj).length + 1}`;
    let n = 0;
    while (Object.prototype.hasOwnProperty.call(obj, placeholder)) {
      placeholder = `key_${Object.keys(obj).length + 1 + (++n)}`;
    }
    obj[placeholder] = '';
    node.config[key] = obj;
    this.cdr.markForCheck();
    this.onNodeFieldChange();
  }

  removeKvPair(node: IFlowNode, key: string, pairKey: string): void {
    if (!node.config) return;
    const obj = { ...(node.config[key] as Record<string, string> || {}) };
    delete obj[pairKey];
    node.config[key] = obj;
    this.onNodeFieldChange();
  }

  setKvPair(node: IFlowNode, key: string, oldKey: string, newKey: string, newVal: string): void {
    if (!node.config) node.config = {};
    const obj = { ...(node.config[key] as Record<string, string> || {}) };
    if (oldKey !== newKey) delete obj[oldKey];
    obj[newKey] = newVal;
    node.config[key] = obj;
    this.onNodeFieldChange();
  }

  // ── WhatsApp reply buttons editor (max 3) ─────────────────────────────────

  getReplyButtons(node: IFlowNode, key: string): Array<{ id: string; title: string }> {
    const v = node.config?.[key];
    return Array.isArray(v) ? (v as Array<{ id: string; title: string }>) : [];
  }

  addReplyButton(node: IFlowNode, key: string): void {
    if (!node.config) node.config = {};
    const list = this.getReplyButtons(node, key);
    if (list.length >= 3) return;
    const n = list.length + 1;
    node.config[key] = [...list, { id: `button_${n}`, title: `Button ${n}` }];
    this.onNodeFieldChange();
  }

  removeReplyButton(node: IFlowNode, key: string, index: number): void {
    if (!node.config) return;
    node.config[key] = this.getReplyButtons(node, key).filter((_, i) => i !== index);
    this.onNodeFieldChange();
  }

  setReplyButtonField(node: IFlowNode, key: string, index: number, field: 'id' | 'title', value: string): void {
    if (!node.config) node.config = {};
    node.config[key] = this.getReplyButtons(node, key).map((b, i) => {
      if (i !== index) return b;
      if (field === 'title') {
        const prevSlug = slugFromTitle(b.title);
        const shouldSyncId = this.paletteSimpleMode || !b.id || b.id === prevSlug || b.id.startsWith('button_');
        return { ...b, title: value, id: shouldSyncId ? slugFromTitle(value) : b.id };
      }
      return { ...b, [field]: value };
    });
    this.onNodeFieldChange();
  }

  replyButtonsFull(node: IFlowNode, key: string): boolean {
    return this.getReplyButtons(node, key).length >= 3;
  }

  // ── WhatsApp list sections editor (max 10 rows total) ─────────────────────

  getListSections(node: IFlowNode, key: string): Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> {
    const v = node.config?.[key];
    return Array.isArray(v) ? (v as Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>) : [];
  }

  listRowCount(node: IFlowNode, key: string): number {
    return this.getListSections(node, key).reduce((sum, s) => sum + (s.rows?.length || 0), 0);
  }

  private commitListSections(node: IFlowNode, key: string, sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>): void {
    if (!node.config) node.config = {};
    node.config[key] = sections;
    this.onNodeFieldChange();
  }

  addListSection(node: IFlowNode, key: string): void {
    const sections = this.getListSections(node, key);
    if (sections.length >= 10) return;
    this.commitListSections(node, key, [...sections, { title: 'Section', rows: [] }]);
  }

  removeListSection(node: IFlowNode, key: string, si: number): void {
    this.commitListSections(node, key, this.getListSections(node, key).filter((_, i) => i !== si));
  }

  setListSectionTitle(node: IFlowNode, key: string, si: number, value: string): void {
    const sections = this.getListSections(node, key).map((s, i) => i === si ? { ...s, title: value } : s);
    this.commitListSections(node, key, sections);
  }

  addListRow(node: IFlowNode, key: string, si: number): void {
    if (this.listRowCount(node, key) >= 10) return;
    const sections = this.getListSections(node, key).map((s, i) => {
      if (i !== si) return s;
      const n = (s.rows?.length || 0) + 1;
      return { ...s, rows: [...(s.rows || []), { id: `row_${si + 1}_${n}`, title: `Option ${n}`, description: '' }] };
    });
    this.commitListSections(node, key, sections);
  }

  removeListRow(node: IFlowNode, key: string, si: number, ri: number): void {
    const sections = this.getListSections(node, key).map((s, i) =>
      i === si ? { ...s, rows: (s.rows || []).filter((_, j) => j !== ri) } : s
    );
    this.commitListSections(node, key, sections);
  }

  setListRowField(node: IFlowNode, key: string, si: number, ri: number, field: 'id' | 'title' | 'description', value: string): void {
    const sections = this.getListSections(node, key).map((s, i) => {
      if (i !== si) return s;
      return { ...s, rows: (s.rows || []).map((r, j) => j === ri ? { ...r, [field]: value } : r) };
    });
    this.commitListSections(node, key, sections);
  }

  listRowsFull(node: IFlowNode, key: string): boolean {
    return this.listRowCount(node, key) >= 10;
  }

  // ── WhatsApp multi-product sections editor (max 30 products total) ────────

  getProductSections(node: IFlowNode, key: string): Array<{ title: string; productIds: string[] }> {
    const v = node.config?.[key];
    return Array.isArray(v) ? (v as Array<{ title: string; productIds: string[] }>) : [];
  }

  productCount(node: IFlowNode, key: string): number {
    return this.getProductSections(node, key).reduce((sum, s) => sum + (s.productIds?.length || 0), 0);
  }

  private commitProductSections(node: IFlowNode, key: string, sections: Array<{ title: string; productIds: string[] }>): void {
    if (!node.config) node.config = {};
    node.config[key] = sections;
    this.onNodeFieldChange();
  }

  addProductSection(node: IFlowNode, key: string): void {
    this.commitProductSections(node, key, [...this.getProductSections(node, key), { title: 'Section', productIds: [] }]);
  }

  removeProductSection(node: IFlowNode, key: string, si: number): void {
    this.commitProductSections(node, key, this.getProductSections(node, key).filter((_, i) => i !== si));
  }

  setProductSectionTitle(node: IFlowNode, key: string, si: number, value: string): void {
    this.commitProductSections(node, key, this.getProductSections(node, key).map((s, i) => i === si ? { ...s, title: value } : s));
  }

  /** Add the chosen product to a section (ignores blanks and duplicates). */
  addProductToSection(node: IFlowNode, key: string, si: number, productId: string): void {
    const id = String(productId || '').trim();
    if (!id || this.productCount(node, key) >= 30) return;
    const sections = this.getProductSections(node, key).map((s, i) => {
      if (i !== si) return s;
      if ((s.productIds || []).includes(id)) return s;
      return { ...s, productIds: [...(s.productIds || []), id] };
    });
    this.commitProductSections(node, key, sections);
  }

  removeProductFromSection(node: IFlowNode, key: string, si: number, pi: number): void {
    const sections = this.getProductSections(node, key).map((s, i) =>
      i === si ? { ...s, productIds: (s.productIds || []).filter((_, j) => j !== pi) } : s
    );
    this.commitProductSections(node, key, sections);
  }

  productSectionsFull(node: IFlowNode, key: string): boolean {
    return this.productCount(node, key) >= 30;
  }

  /** Display name for a product id (falls back to the id when not loaded). */
  productName(productId: string): string {
    return this.products.find((p) => p._id === productId)?.name || productId;
  }

  toggleCat(cat: string): void {
    if (this.collapsedCats.has(cat)) {
      this.collapsedCats.delete(cat);
    } else {
      this.collapsedCats.add(cat);
    }
    this.cdr.markForCheck();
  }

  isCatCollapsed(cat: string): boolean {
    return this.collapsedCats.has(cat);
  }

  backToList(): void {
    this.router.navigate(['/app/automation/flows']);
  }
}
