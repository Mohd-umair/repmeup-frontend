import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { WhatsAppFlowService, IWhatsAppFlow, IWhatsAppFlowStep } from '../../../core/services/whatsapp-flow.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';

const BLUEPRINTS: IWhatsAppFlow[] = [
  { name: 'Appointment Booking', isBlueprint: true, status: 'draft', trigger: { type: 'keyword', value: 'appointment' }, description: 'Book appointments via WhatsApp with automated confirmation.', steps: [] },
  { name: 'Product Purchase', isBlueprint: true, status: 'draft', trigger: { type: 'keyword', value: 'buy' }, description: 'Guide customers from inquiry to purchase automatically.', steps: [] },
  { name: 'Complaint Register', isBlueprint: true, status: 'draft', trigger: { type: 'keyword', value: 'complaint' }, description: 'Capture and route complaints for faster resolution.', steps: [] },
  { name: 'Retargeting', isBlueprint: true, status: 'draft', trigger: { type: 'new_lead', value: '' }, description: 'Re-engage cold leads with a multi-step WhatsApp sequence.', steps: [] },
  { name: 'Review Collection', isBlueprint: true, status: 'draft', trigger: { type: 'order', value: 'delivered' }, description: 'Automatically request reviews post-delivery.', steps: [] },
  { name: 'Refund Seeking', isBlueprint: true, status: 'draft', trigger: { type: 'keyword', value: 'refund' }, description: 'Handle refund requests with escalation and updates.', steps: [] },
];

const TRIGGER_LABELS: Record<string, string> = {
  keyword: 'Keyword match',
  new_lead: 'New lead',
  first_message: 'First message',
  manual: 'Manual trigger',
  webhook: 'Webhook',
  appointment: 'Appointment event',
  order: 'Order event'
};

@Component({
  selector: 'app-whatsapp-flows',
  standalone: true,
  imports: [CommonModule, FormsModule, AutomationPageShellComponent, AutomationSwitchComponent],
  templateUrl: './whatsapp-flows.component.html',
  styleUrls: ['./whatsapp-flows.component.scss']
})
export class WhatsAppFlowsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'my-flows' | 'blueprints' = 'my-flows';

  readonly tabs: { id: 'my-flows' | 'blueprints'; label: string }[] = [
    { id: 'my-flows', label: 'My Flows' },
    { id: 'blueprints', label: 'Blueprints' }
  ];

  setTab(id: 'my-flows' | 'blueprints'): void {
    this.activeTab = id;
  }

  flows: IWhatsAppFlow[] = [];
  loading = true;
  deleting = new Set<string>();
  toggling = new Set<string>();

  showEditor = false;
  editingFlow: IWhatsAppFlow | null = null;
  saving = false;

  blueprints = BLUEPRINTS;
  triggerLabels = TRIGGER_LABELS;

  constructor(
    private flowService: WhatsAppFlowService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void { this.loadFlows(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadFlows(): void {
    this.loading = true;
    this.flowService.listFlows()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({ next: r => { this.flows = (r.data ?? []).filter(f => !f.isBlueprint); } });
  }

  openCreate(blueprint?: IWhatsAppFlow): void {
    this.editingFlow = blueprint
      ? { ...blueprint, _id: undefined, isBlueprint: false, status: 'draft' }
      : { name: '', status: 'draft', trigger: { type: 'keyword', value: '' }, steps: [] };
    this.showEditor = true;
    this.activeTab = 'my-flows';
  }

  openEdit(f: IWhatsAppFlow): void { this.editingFlow = { ...f }; this.showEditor = true; }
  closeEditor(): void { this.showEditor = false; this.editingFlow = null; }

  save(): void {
    if (!this.editingFlow) return;
    this.saving = true;
    const obs = this.editingFlow._id
      ? this.flowService.updateFlow(this.editingFlow._id, this.editingFlow)
      : this.flowService.createFlow(this.editingFlow);
    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; }))
      .subscribe({
        next: r => {
          this.notify.success('Saved', 'WhatsApp Flow saved.');
          if (!this.editingFlow?._id && r.data) this.flows.unshift(r.data);
          else if (r.data) { const idx = this.flows.findIndex(f => f._id === r.data?._id); if (idx >= 0) this.flows[idx] = r.data; }
          this.closeEditor();
        },
        error: err => this.notify.error('Error', err?.error?.error || 'Failed to save.')
      });
  }

  toggleStatus(flow: IWhatsAppFlow): void {
    if (!flow._id) return;
    this.toggling.add(flow._id);
    const obs = flow.status === 'active' ? this.flowService.pauseFlow(flow._id) : this.flowService.activateFlow(flow._id);
    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.toggling.delete(flow._id!); }))
      .subscribe({ next: r => { if (r.data) { const idx = this.flows.findIndex(f => f._id === r.data?._id); if (idx >= 0) this.flows[idx] = r.data; } } });
  }

  /** Keeps switch in sync with API: only calls toggle when desired active state differs. */
  onFlowActiveChange(flow: IWhatsAppFlow, active: boolean): void {
    const isActive = flow.status === 'active';
    if (active === isActive || !flow._id) return;
    this.toggleStatus(flow);
  }

  delete(id: string): void {
    this.deleting.add(id);
    this.flowService.deleteFlow(id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.deleting.delete(id); }))
      .subscribe({ next: () => { this.flows = this.flows.filter(f => f._id !== id); this.notify.success('Deleted', 'Flow removed.'); } });
  }

  addStep(): void {
    if (!this.editingFlow) return;
    const order = this.editingFlow.steps?.length ?? 0;
    this.editingFlow.steps = [...(this.editingFlow.steps || []), { order, messageText: '', delaySec: 0 }];
  }

  removeStep(i: number): void {
    if (!this.editingFlow) return;
    this.editingFlow.steps = this.editingFlow.steps.filter((_, idx) => idx !== i);
  }

  getTriggerLabel(type: string): string { return TRIGGER_LABELS[type] ?? type; }
  trackById(i: number, f: IWhatsAppFlow): string { return f._id ?? String(i); }
  trackByIndex(i: number): number { return i; }
}
