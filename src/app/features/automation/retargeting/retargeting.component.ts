import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { RetargetingService, IRetargetingFlow, IRetargetingStep } from '../../../core/services/retargeting.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { AutomationStatusBadgeComponent } from '../shared/automation-status-badge.component';
import { AutomationChannelToggleComponent, ALL_CHANNELS } from '../shared/automation-channel-toggle.component';

const AUDIENCE_TYPES = [
  { key: 'ig_engagers',    label: 'Instagram Engagers',    icon: 'fab fa-instagram', desc: 'Users who liked, commented or shared recently.' },
  { key: 'abandoned_cart', label: 'Abandoned Cart',         icon: 'fas fa-shopping-cart', desc: 'Customers who started checkout but didn\'t complete.' },
  { key: 'new_leads',      label: 'New Leads',              icon: 'fas fa-user-plus', desc: 'Contacts who created a new inbox thread recently.' },
  { key: 'customer_segment', label: 'Customer Segment',    icon: 'fas fa-users', desc: 'A filtered subset of your contact list.' },
  { key: 'all_contacts',   label: 'All Contacts',           icon: 'fas fa-address-book', desc: 'Your entire contact database.' },
];

@Component({
  selector: 'app-retargeting',
  standalone: true,
  imports: [CommonModule, FormsModule, AutomationPageShellComponent],
  templateUrl: './retargeting.component.html',
  styleUrls: ['./retargeting.component.scss']
})
export class RetargetingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  flows: IRetargetingFlow[] = [];
  loading = true;
  deleting = new Set<string>();

  showEditor = false;
  editingFlow: IRetargetingFlow | null = null;
  saving = false;
  previewingAudience = false;
  audiencePreviewSize: number | null = null;

  audienceTypes = AUDIENCE_TYPES;
  allChannels = ALL_CHANNELS;
  editorTab: 'audience' | 'steps' | 'settings' = 'audience';

  blankFlow = (): IRetargetingFlow => ({
    name: '',
    status: 'draft',
    audience: { type: 'all_contacts', audienceWindowDays: 30 },
    channels: ['whatsapp'],
    steps: [{ order: 0, type: 'message', content: '', delaySec: 0 }],
    settings: { frequencyCap: 1, frequencyCapWindowDays: 30, quietHoursStart: '22:00', quietHoursEnd: '08:00' }
  });

  constructor(
    private retargetingService: RetargetingService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void { this.loadFlows(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadFlows(): void {
    this.loading = true;
    this.retargetingService.listFlows()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({ next: r => { this.flows = r.data ?? []; } });
  }

  openCreate(): void { this.editingFlow = this.blankFlow(); this.audiencePreviewSize = null; this.editorTab = 'audience'; this.showEditor = true; }

  openEdit(f: IRetargetingFlow): void { this.editingFlow = { ...f }; this.audiencePreviewSize = null; this.showEditor = true; }

  closeEditor(): void { this.showEditor = false; this.editingFlow = null; }

  save(): void {
    if (!this.editingFlow) return;
    this.saving = true;
    const obs = this.editingFlow._id
      ? this.retargetingService.updateFlow(this.editingFlow._id, this.editingFlow)
      : this.retargetingService.createFlow(this.editingFlow);
    obs.pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; }))
      .subscribe({
        next: r => {
          this.notify.success('Saved', 'Flow saved.');
          if (!this.editingFlow?._id && r.data) this.flows.unshift(r.data);
          else if (r.data) { const idx = this.flows.findIndex(f => f._id === r.data?._id); if (idx >= 0) this.flows[idx] = r.data; }
          this.closeEditor();
        },
        error: err => this.notify.error('Error', err?.error?.error || 'Failed to save.')
      });
  }

  delete(id: string): void {
    this.deleting.add(id);
    this.retargetingService.deleteFlow(id)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.deleting.delete(id); }))
      .subscribe({ next: () => { this.flows = this.flows.filter(f => f._id !== id); this.notify.success('Deleted', 'Flow removed.'); } });
  }

  setAudienceType(type: string): void {
    if (!this.editingFlow) return;
    this.editingFlow.audience = { ...this.editingFlow.audience, type };
  }

  previewAudience(): void {
    if (!this.editingFlow) return;
    this.previewingAudience = true; this.audiencePreviewSize = null;
    this.retargetingService.previewAudience(this.editingFlow.audience.type, this.editingFlow.audience.filters)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.previewingAudience = false; }))
      .subscribe({ next: r => { this.audiencePreviewSize = r.data?.estimatedSize ?? 0; } });
  }

  addStep(): void {
    if (!this.editingFlow) return;
    const order = (this.editingFlow.steps?.length ?? 0);
    this.editingFlow.steps = [...(this.editingFlow.steps || []), { order, type: 'message', content: '', delaySec: 0 }];
  }

  removeStep(i: number): void {
    if (!this.editingFlow) return;
    this.editingFlow.steps = this.editingFlow.steps.filter((_, idx) => idx !== i);
  }

  getAudienceLabel(key: string): string { return this.audienceTypes.find(a => a.key === key)?.label ?? key; }
  trackById(i: number, f: IRetargetingFlow): string { return f._id ?? String(i); }
  trackByIndex(i: number): number { return i; }
}
