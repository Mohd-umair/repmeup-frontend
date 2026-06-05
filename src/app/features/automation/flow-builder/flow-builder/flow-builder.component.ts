import {
  Component,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil, finalize } from 'rxjs/operators';
import { FlowBuilderService } from '../../../../core/services/flow-builder.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { WhatsAppTemplateService } from '../../../../core/services/whatsapp-template.service';
import { PlatformConnectionService, PlatformConnection } from '../../../../core/services/platform-connection.service';
import { IntentBucketService } from '../../../../core/services/intent-bucket.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { WhatsAppTemplate } from '../../../../core/models/whatsapp-template.model';
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
  getConfigFieldDef
} from '../utils/flow-node-defaults.util';

const CATEGORY_ORDER: NodeCategory[] = ['trigger', 'action', 'condition', 'wait', 'control'];
const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  action: 'Actions',
  condition: 'Logic',
  wait: 'Wait',
  control: 'Control'
};

@Component({
  selector: 'app-flow-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  testResult: { startNodeId: string; stepPreview: Array<{ nodeId: string; type: string; label: string }> } | null = null;
  testing = false;

  // Pickers
  intentBuckets: Array<{ _id: string; name: string }> = [];
  products: Array<{ _id: string; name: string }> = [];
  readonly edgeBranchPresets = ['yes', 'no', 'reply', 'no_reply'];

  canvasOffset = { x: 0, y: 0 };
  zoom = 1;
  private readonly minZoom = 0.4;
  private readonly maxZoom = 1.8;
  private dragNode: IFlowNode | null = null;
  private dragStart = { x: 0, y: 0, nx: 0, ny: 0 };
  private panning = false;
  private panStart = { x: 0, y: 0, ox: 0, oy: 0 };

  readonly categoryOrder = CATEGORY_ORDER;
  readonly categoryLabels = CATEGORY_LABELS;
  channelOptions: FlowChannel[] = ['whatsapp', 'instagram', 'facebook'];
  collapsedCats = new Set(['action', 'condition', 'wait', 'control']);

  waConnections: PlatformConnection[] = [];
  waConnectionId = '';
  waTemplates: WhatsAppTemplate[] = [];
  waTemplatesLoading = false;
  waTemplatesError = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private flowService: FlowBuilderService,
    private notify: NotificationService,
    private whatsAppTemplateService: WhatsAppTemplateService,
    private platformConnectionService: PlatformConnectionService,
    private intentBucketService: IntentBucketService,
    private catalogService: CatalogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.flowId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.flowId) {
      this.router.navigate(['/app/automation/flows']);
      return;
    }

    this.save$.pipe(debounceTime(800), takeUntil(this.destroy$)).subscribe(() => this.persist());

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
  }

  ngOnDestroy(): void {
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
      if (!q) return true;
      return item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
    });
  }

  catalogByCategory(cat: NodeCategory): IFlowNodeCatalogItem[] {
    return this.filteredCatalog.filter((c) => c.category === cat);
  }

  loadFlow(): void {
    this.loading = true;
    this.flowService.getFlow(this.flowId)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (r) => {
          this.flow = r.data ?? null;
          if (this.flow && !this.flow.nodes.length) {
            this.addNodeFromCatalog(this.catalog.find((c) => c.category === 'trigger') || this.catalog[0]);
          }
          this.cdr.markForCheck();
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
        error: (err) => this.notify.error('Save failed', err.error?.error || 'Could not save flow.')
      });
  }

  saveNow(): void {
    this.persist();
  }

  publish(): void {
    if (!this.flow?._id) return;
    this.publishing = true;
    this.flowService.publishFlow(this.flow._id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.publishing = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (r) => {
          this.flow = r.data ?? this.flow;
          this.notify.success('Published', 'Flow is now active.');
        },
        error: (err) => this.notify.error('Publish failed', err.error?.error || 'Fix validation errors first.')
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
    const ids = new Set<string>();
    for (const e of this.validationErrors) {
      if (e.nodeId) ids.add(e.nodeId);
      (e.nodeIds || []).forEach((id: string) => ids.add(id));
    }
    return ids;
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
                this.testResult = r.data
                  ? { startNodeId: r.data.startNodeId, stepPreview: (r.data.stepPreview as any) || [] }
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

  /** Frame all nodes within the canvas viewport. */
  fitView(): void {
    if (!this.flow?.nodes.length) { this.zoomReset(); return; }
    const xs = this.flow.nodes.map((n) => n.position.x);
    const ys = this.flow.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 220;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 90;
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
    const z = Math.min(this.maxZoom, Math.max(this.minZoom, Math.min(900 / w, 560 / h)));
    this.zoom = Math.round(z * 100) / 100;
    this.canvasOffset = { x: 40 - minX * this.zoom, y: 40 - minY * this.zoom };
    this.cdr.markForCheck();
  }

  onCanvasPointerDown(event: PointerEvent): void {
    // Start panning only when the empty canvas background is grabbed.
    const target = event.target as HTMLElement;
    if (target.closest('.fb-node') || target.closest('.fb-edge-hit')) return;
    this.selectedNodeId = null;
    this.selectedEdgeId = null;
    this.panning = true;
    this.panStart = { x: event.clientX, y: event.clientY, ox: this.canvasOffset.x, oy: this.canvasOffset.y };
    this.cdr.markForCheck();
  }

  /** Click-to-add: drops a node at a cascading offset (drag-and-drop is preferred). */
  addNodeFromCatalog(item?: IFlowNodeCatalogItem): void {
    if (!this.flow || !item) return;
    const n = this.flow.nodes.length;
    this.createNodeAt(item, 120 + n * 40, 120 + n * 30);
  }

  /** Shared node factory used by both click-to-add and drag-and-drop. */
  private createNodeAt(item: IFlowNodeCatalogItem, x: number, y: number): void {
    if (!this.flow) return;
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const node: IFlowNode = {
      id,
      type: item.type,
      label: item.label,
      position: { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) },
      config: buildDefaultConfig(item),
      supportedChannels: item.supportedChannels as FlowChannel[]
    };
    this.flow.nodes = [...this.flow.nodes, node];
    this.selectedNodeId = id;
    this.selectedEdgeId = null;
    if (item.type === 'action.send_template') {
      this.ensureWaTemplatesLoaded();
    }
    this.queueSave();
    this.cdr.markForCheck();
  }

  // ── Drag-and-drop from palette → canvas ────────────────────────────────────
  private draggedItem: IFlowNodeCatalogItem | null = null;
  dragOverCanvas = false;

  onPaletteDragStart(item: IFlowNodeCatalogItem, event: DragEvent): void {
    this.draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      // Some browsers require data to be set for the drag to start.
      event.dataTransfer.setData('text/plain', item.type);
    }
  }

  onPaletteDragEnd(): void {
    this.draggedItem = null;
    this.dragOverCanvas = false;
    this.cdr.markForCheck();
  }

  onCanvasDragOver(event: DragEvent): void {
    if (!this.draggedItem) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    if (!this.dragOverCanvas) {
      this.dragOverCanvas = true;
      this.cdr.markForCheck();
    }
  }

  onCanvasDragLeave(event: DragEvent): void {
    // Only clear when leaving the wrapper itself, not when moving over child nodes.
    if (event.target === event.currentTarget) {
      this.dragOverCanvas = false;
      this.cdr.markForCheck();
    }
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOverCanvas = false;
    const item = this.draggedItem;
    this.draggedItem = null;
    if (!item) return;

    const canvasEl = (event.currentTarget as HTMLElement).querySelector('.fb-canvas');
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect) { this.addNodeFromCatalog(item); return; }

    // getBoundingClientRect already reflects pan + zoom (transform-origin 0 0),
    // so undo only the scale to land in content coordinates. Center the card on the cursor.
    const x = (event.clientX - rect.left) / this.zoom - 110;
    const y = (event.clientY - rect.top) / this.zoom - 28;
    this.createNodeAt(item, x, y);
  }

  /** Category key used to colour-code nodes and palette chips. */
  nodeCategoryOf(type: string): NodeCategory {
    return (type.split('.')[0] as NodeCategory) || 'action';
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.selectedEdgeId = null;
    this.ensureNodeConfig(this.selectedNode);
    if (this.selectedNode?.type === 'action.send_template') {
      this.ensureWaTemplatesLoaded();
    }
    this.cdr.markForCheck();
  }

  loadWaConnections(): void {
    this.platformConnectionService.getConnections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.waConnections = (res.data || []).filter(
            (c) => c.platform === 'whatsapp' && c.status === 'connected' && c.isActive
          );
          if (!this.waConnectionId && this.waConnections.length) {
            this.waConnectionId = this.waConnections[0]._id;
            this.loadWaTemplates();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.waConnections = [];
          this.cdr.markForCheck();
        }
      });
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

  showWaTemplatePicker(node: IFlowNode, key: string): boolean {
    return node.type === 'action.send_template' && key === 'templateId';
  }

  get showWaConnectionSelector(): boolean {
    return this.waConnections.length > 1;
  }

  catalogItemFor(node: IFlowNode | null): IFlowNodeCatalogItem | undefined {
    if (!node) return undefined;
    return this.catalog.find((c) => c.type === node.type);
  }

  private ensureNodeConfig(node: IFlowNode | null): void {
    if (!node) return;
    ensureNodeConfigKeys(node, this.catalogItemFor(node));
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
    const existing = this.flow.edges.filter((e) => e.source === sourceNode.id).length;
    if (sourceNode.type.startsWith('condition.')) return existing === 0 ? 'yes' : existing === 1 ? 'no' : '';
    if (sourceNode.type === 'wait.user_reply') return existing === 0 ? 'reply' : existing === 1 ? 'no_reply' : '';
    if (sourceNode.type === 'control.ab_split') return existing === 0 ? 'A' : existing === 1 ? 'B' : '';
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
    this.flow.nodes = this.flow.nodes.filter((n) => n.id !== id);
    this.flow.edges = this.flow.edges.filter((e) => e.source !== id && e.target !== id);
    this.selectedNodeId = null;
    this.queueSave();
    this.cdr.markForCheck();
  }

  onNodeFieldChange(): void {
    this.queueSave();
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
    if (this.dragNode && this.flow) {
      const dx = (event.clientX - this.dragStart.x) / this.zoom;
      const dy = (event.clientY - this.dragStart.y) / this.zoom;
      this.dragNode.position = {
        x: Math.max(0, this.dragStart.nx + dx),
        y: Math.max(0, this.dragStart.ny + dy)
      };
      this.cdr.markForCheck();
      return;
    }
    if (this.panning) {
      this.canvasOffset = {
        x: this.panStart.ox + (event.clientX - this.panStart.x),
        y: this.panStart.oy + (event.clientY - this.panStart.y)
      };
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:pointerup')
  onPointerUp(): void {
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedEdgeId) { this.deleteSelectedEdge(); event.preventDefault(); }
      else if (this.selectedNodeId) { this.deleteSelectedNode(); event.preventDefault(); }
    } else if (event.key === 'Escape') {
      this.connectingFrom = null;
      this.selectedEdgeId = null;
      this.closePanels();
      this.cdr.markForCheck();
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
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      config: JSON.parse(JSON.stringify(src.config || {})),
      supportedChannels: src.supportedChannels
    };
    this.flow.nodes = [...this.flow.nodes, copy];
    this.selectedNodeId = id;
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
