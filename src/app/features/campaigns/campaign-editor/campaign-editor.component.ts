import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { CampaignService, ICampaign } from '../../../core/services/campaign.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformService, PlatformConnection } from '../../../core/services/platform.service';
import { WhatsAppTemplateService } from '../../../core/services/whatsapp-template.service';
import { WhatsAppTemplate, TemplateComponent } from '../../../core/models/whatsapp-template.model';

type Step = 1 | 2 | 3 | 4 | 5;

interface VariableField {
  key: string;   // e.g. "body_0_1"
  label: string;
  value: string;
}

@Component({
  selector: 'app-campaign-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './campaign-editor.component.html'
})
export class CampaignEditorComponent implements OnInit, OnDestroy {
  @Input() campaign: ICampaign | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // ── Stepper ────────────────────────────────────────────────────────────────
  step: Step = 1;
  readonly steps = [
    { num: 1, label: 'Details' },
    { num: 2, label: 'Template' },
    { num: 3, label: 'Audience' },
    { num: 4, label: 'Schedule' },
    { num: 5, label: 'Review' }
  ];

  // ── Step 1: Details ────────────────────────────────────────────────────────
  campaignName = '';
  selectedConnectionId = '';
  connections: PlatformConnection[] = [];
  connectionsLoading = true;

  // ── Step 2: Template ───────────────────────────────────────────────────────
  templates: WhatsAppTemplate[] = [];
  templatesLoading = false;
  selectedTemplate: WhatsAppTemplate | null = null;
  variableFields: VariableField[] = [];

  // ── Step 3: Audience ───────────────────────────────────────────────────────
  audienceTab: 'paste' | 'upload' = 'paste';
  rawPhoneText = '';
  uploadedFileName = '';
  recipientCount = 0;
  audienceLoading = false;
  parseResult: { inserted: number; duplicates: number; skipped: number; total: number } | null = null;

  // ── Step 4: Schedule ───────────────────────────────────────────────────────
  sendNow = true;
  scheduledDate = '';   // date part: yyyy-MM-dd
  scheduledTime = '';   // time part: HH:mm
  minDate = '';

  // ── Step 5: Review ─────────────────────────────────────────────────────────
  testPhone = '';
  testSending = false;
  testSent = false;
  testError = '';

  // ── Shared ────────────────────────────────────────────────────────────────
  createdCampaignId = '';
  saving = false;
  launching = false;

  constructor(
    private campaignService: CampaignService,
    private notify: NotificationService,
    private platformService: PlatformService,
    private templateService: WhatsAppTemplateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Set minimum date to today
    const now = new Date();
    this.minDate = now.toISOString().slice(0, 16);

    // Pre-fill if editing an existing draft
    if (this.campaign) {
      this.createdCampaignId = this.campaign._id;
      this.campaignName = this.campaign.name;
      const conn = this.campaign.connection;
      this.selectedConnectionId = typeof conn === 'string' ? conn : conn?._id;
      this.recipientCount = this.campaign.stats?.total || 0;
      if (this.campaign.scheduledAt) {
        this.sendNow = false;
        const d = new Date(this.campaign.scheduledAt);
        this.scheduledDate = d.toISOString().slice(0, 10);
        this.scheduledTime = d.toISOString().slice(11, 16);
      }
    }

    this.loadConnections();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Connections ──────────────────────────────────────────────────────────

  loadConnections(): void {
    this.connectionsLoading = true;
    this.platformService.getPlatformConnections()
      .pipe(takeUntil(this.destroy$), finalize(() => (this.connectionsLoading = false)))
      .subscribe({
        next: r => {
          this.connections = (r.data || []).filter(
            c => c.platform === 'whatsapp' && c.isActive
          );
          if (this.connections.length === 1 && !this.selectedConnectionId) {
            this.selectedConnectionId = this.connections[0]._id;
          }
        },
        error: () => this.notify.error('Failed to load WhatsApp connections')
      });
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  loadTemplates(): void {
    this.templatesLoading = true;
    const connId = this.selectedConnectionId || undefined;
    this.templateService.listTemplates(connId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.templatesLoading = false)))
      .subscribe({
        next: r => {
          this.templates = (r.templates || []).filter(t => t.status === 'APPROVED');
          // Pre-select if editing — templateRef may be a Mongo id string or populated object
          if (this.campaign?.templateRef) {
            const tid =
              typeof this.campaign.templateRef === 'string'
                ? this.campaign.templateRef
                : (this.campaign.templateRef as WhatsAppTemplate)._id;
            if (tid) {
              this.selectedTemplate =
                this.templates.find(t => t._id === tid || (t as { id?: string }).id === tid) || null;
              if (this.selectedTemplate) this.extractVariableFields(this.selectedTemplate);
            }
          }
        },
        error: () => this.notify.error('Failed to load templates')
      });
  }

  selectTemplate(t: WhatsAppTemplate): void {
    this.selectedTemplate = t;
    this.extractVariableFields(t);
  }

  extractVariableFields(template: WhatsAppTemplate): void {
    this.variableFields = [];
    const body = template.components?.find(c => c.type === 'BODY');
    if (!body?.text) return;

    const positional = [...(body.text.matchAll(/\{\{(\d+)\}\}/g))];
    positional.forEach(m => {
      const num = m[1];
      if (!this.variableFields.find(v => v.key === `body_${num}`)) {
        this.variableFields.push({ key: `body_${num}`, label: `Body variable {{${num}}}`, value: '' });
      }
    });
  }

  buildTemplateComponents(): unknown[] {
    if (!this.selectedTemplate || this.variableFields.length === 0) return [];
    const bodyParams = this.variableFields
      .filter(v => v.key.startsWith('body_'))
      .map(v => ({ type: 'text', text: v.value || ' ' }));
    if (bodyParams.length === 0) return [];
    return [{ type: 'body', parameters: bodyParams }];
  }

  getBodyText(template: WhatsAppTemplate): string {
    return template.components?.find(c => c.type === 'BODY')?.text || '';
  }

  getHeaderText(template: WhatsAppTemplate): string {
    const header = template.components?.find(c => c.type === 'HEADER');
    return header?.text || '';
  }

  hasVariables(template: WhatsAppTemplate): boolean {
    const body = template.components?.find(c => c.type === 'BODY');
    return !!body?.text?.includes('{{');
  }

  // ─── Audience ─────────────────────────────────────────────────────────────

  setAudienceTab(tab: 'paste' | 'upload'): void {
    this.audienceTab = tab;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      this.rawPhoneText = (e.target?.result as string) || '';
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  submitAudience(): void {
    if (!this.rawPhoneText.trim()) {
      this.notify.warning('Please enter or upload phone numbers');
      return;
    }
    if (!this.createdCampaignId) {
      this.notify.error('Campaign must be saved first (go to step 1)');
      return;
    }
    this.audienceLoading = true;
    this.parseResult = null;
    this.campaignService.addRecipients(this.createdCampaignId, this.rawPhoneText)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.audienceLoading = false)))
      .subscribe({
        next: r => {
          this.parseResult = r;
          this.recipientCount = r.total;
          this.notify.success(`${r.inserted} recipients added`);
        },
        error: err => this.notify.error(err?.error?.error || 'Failed to add recipients')
      });
  }

  clearAudience(): void {
    if (!this.createdCampaignId) return;
    this.audienceLoading = true;
    this.campaignService.clearRecipients(this.createdCampaignId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.audienceLoading = false)))
      .subscribe({
        next: () => {
          this.recipientCount = 0;
          this.rawPhoneText = '';
          this.parseResult = null;
          this.uploadedFileName = '';
          this.notify.success('Recipients cleared');
        },
        error: () => this.notify.error('Failed to clear recipients')
      });
  }

  // ─── Test send ────────────────────────────────────────────────────────────

  sendTest(): void {
    if (!this.testPhone.trim()) {
      this.notify.warning('Enter a phone number to test');
      return;
    }
    this.testSending = true;
    this.testSent = false;
    this.testError = '';
    this.campaignService.sendTestMessage(
      this.createdCampaignId,
      this.testPhone,
      this.buildTemplateComponents()
    )
      .pipe(takeUntil(this.destroy$), finalize(() => (this.testSending = false)))
      .subscribe({
        next: () => {
          this.testSent = true;
          this.notify.success('Test message sent successfully');
        },
        error: err => {
          this.testError = err?.error?.error || 'Failed to send test message';
          this.notify.error(this.testError);
        }
      });
  }

  // ─── Stepper navigation ───────────────────────────────────────────────────

  canProceedStep1(): boolean {
    return this.campaignName.trim().length > 0 && this.selectedConnectionId.length > 0;
  }

  canProceedStep2(): boolean {
    return !!this.selectedTemplate;
  }

  canProceedStep3(): boolean {
    return this.recipientCount > 0;
  }

  /** Back / Cancel in footer — avoids template `step - 1` (number) vs Step union mismatch. */
  goToPreviousStep(): void {
    switch (this.step) {
      case 1:
        this.close();
        break;
      case 2:
        this.step = 1;
        break;
      case 3:
        this.step = 2;
        break;
      case 4:
        this.step = 3;
        break;
      case 5:
        this.step = 4;
        break;
    }
  }

  goToStep(target: Step): void {
    if (target < this.step) {
      this.step = target;
      return;
    }
    if (target === 2 && this.step === 1) {
      this.proceedStep1();
    } else if (target === 3 && this.step === 2) {
      this.proceedStep2();
    } else if (target === 4 && this.step === 3) {
      this.step = 4;
    } else if (target === 5 && this.step === 4) {
      this.step = 5;
    }
  }

  proceedStep1(): void {
    if (!this.canProceedStep1()) {
      this.notify.warning('Enter a campaign name and select a WhatsApp number');
      return;
    }
    this.saving = true;

    const action = this.createdCampaignId
      ? this.campaignService.updateCampaign(this.createdCampaignId, {
          name: this.campaignName,
          connection: this.selectedConnectionId as unknown as any
        })
      : this.campaignService.createCampaign({
          name: this.campaignName,
          connectionId: this.selectedConnectionId
        });

    action
      .pipe(takeUntil(this.destroy$), finalize(() => (this.saving = false)))
      .subscribe({
        next: r => {
          this.createdCampaignId = r.campaign?._id || this.createdCampaignId;
          this.loadTemplates();
          this.step = 2;
        },
        error: err => this.notify.error(err?.error?.error || 'Failed to save campaign')
      });
  }

  proceedStep2(): void {
    if (!this.canProceedStep2()) {
      this.notify.warning('Please select an approved template');
      return;
    }
    const templateKey = this.selectedTemplate!._id ?? (this.selectedTemplate as WhatsAppTemplate & { id?: string }).id;
    if (!templateKey) {
      this.notify.warning('Template id missing — reload templates and try again');
      return;
    }
    this.saving = true;
    this.campaignService.updateCampaign(this.createdCampaignId, {
      templateRef: templateKey as unknown as any
    })
      .pipe(takeUntil(this.destroy$), finalize(() => (this.saving = false)))
      .subscribe({
        next: () => { this.step = 3; },
        error: err => this.notify.error(err?.error?.error || 'Failed to save template selection')
      });
  }

  getScheduledDate(): Date | null {
    if (this.sendNow || !this.scheduledDate || !this.scheduledTime) return null;
    return new Date(`${this.scheduledDate}T${this.scheduledTime}`);
  }

  launch(): void {
    if (!this.canProceedStep3()) {
      this.notify.warning('Please add recipients first');
      return;
    }
    const schedDate = this.getScheduledDate();
    if (!this.sendNow && !schedDate) {
      this.notify.warning('Please select a schedule date and time');
      return;
    }
    if (!this.sendNow && schedDate && schedDate <= new Date()) {
      this.notify.warning('Scheduled time must be in the future');
      return;
    }

    this.launching = true;

    // Save scheduledAt first, then launch
    const updateObs = !this.sendNow && schedDate
      ? this.campaignService.updateCampaign(this.createdCampaignId, {
          scheduledAt: schedDate.toISOString() as unknown as any
        })
      : this.campaignService.updateCampaign(this.createdCampaignId, {
          scheduledAt: null as unknown as any
        });

    updateObs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.campaignService.launchCampaign(this.createdCampaignId, this.buildTemplateComponents())
          .pipe(takeUntil(this.destroy$), finalize(() => (this.launching = false)))
          .subscribe({
            next: r => {
              const isScheduled = r.campaign?.status === 'scheduled';
              this.notify.success(
                isScheduled ? 'Campaign scheduled!' : 'Campaign launched!',
                isScheduled ? `Will send at ${new Date(r.campaign!.scheduledAt!).toLocaleString()}` : `Sending to ${this.recipientCount} recipients`
              );
              this.saved.emit();
            },
            error: err => {
              this.launching = false;
              this.notify.error(err?.error?.error || 'Failed to launch campaign');
            }
          });
      },
      error: err => {
        this.launching = false;
        this.notify.error(err?.error?.error || 'Failed to save schedule');
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getConnectionDisplay(conn: PlatformConnection): string {
    const phone = conn.platformData?.displayPhoneNumber || conn.platformData?.phoneNumber;
    const name = conn.platformDisplayName || conn.platformUsername;
    return phone ? `${name ? name + ' · ' : ''}${phone}` : (name || conn._id);
  }

  categoryColor(cat: string): string {
    const map: Record<string, string> = {
      MARKETING: 'bg-purple-500/20 text-purple-400',
      UTILITY: 'bg-blue-500/20 text-blue-400',
      AUTHENTICATION: 'bg-orange-500/20 text-orange-400'
    };
    return map[cat] || 'bg-gray-500/20 text-gray-400';
  }
}
