import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import {
  CampaignService,
  ICampaign,
  ICampaignHeaderLocation,
  ICampaignHeaderMedia,
  ICampaignUrlButtonParam,
  ICsvPreviewResponse,
  ICsvUploadMapping,
  ITemplateSlots
} from '../../../core/services/campaign.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformService, PlatformConnection } from '../../../core/services/platform.service';
import { WhatsAppTemplateService } from '../../../core/services/whatsapp-template.service';
import { WhatsAppTemplate } from '../../../core/models/whatsapp-template.model';

import { FileUploadZoneComponent } from '../../../shared/components/file-upload-zone/file-upload-zone.component';
import {
  TemplateParamFormComponent,
  TemplateParamFormState
} from '../shared/template-param-form/template-param-form.component';
import { CsvColumnMapperComponent } from '../shared/csv-column-mapper/csv-column-mapper.component';

type Step = 1 | 2 | 3 | 4 | 5;

@Component({
  selector: 'app-campaign-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    FileUploadZoneComponent,
    TemplateParamFormComponent,
    CsvColumnMapperComponent
  ],
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

  // ── Step 2: Template / Params ──────────────────────────────────────────────
  templates: WhatsAppTemplate[] = [];
  templatesLoading = false;
  selectedTemplate: WhatsAppTemplate | null = null;
  templateSlots: ITemplateSlots | null = null;
  templateSlotsLoading = false;

  paramFormState: TemplateParamFormState = {
    defaultParams: {},
    varsFromCsv: [],
    headerMedia: undefined,
    headerLocation: undefined,
    urlButtonParams: []
  };

  // ── Step 3: Audience ───────────────────────────────────────────────────────
  audienceTab: 'paste' | 'upload' = 'paste';
  rawPhoneText = '';
  uploadedCsvFiles: File[] = [];
  uploadedFileName = '';
  csvPreview: ICsvPreviewResponse | null = null;
  csvMapping: ICsvUploadMapping | null = null;
  recipientCount = 0;
  audienceLoading = false;
  audiencePreviewLoading = false;
  parseResult: { inserted: number; duplicates: number; skipped: number; total: number } | null = null;

  // ── Step 4: Schedule ───────────────────────────────────────────────────────
  sendNow = true;
  scheduledDate = '';
  scheduledTime = '';
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
    const now = new Date();
    this.minDate = now.toISOString().slice(0, 16);

    if (this.campaign) {
      this.createdCampaignId = this.campaign._id;
      this.campaignName = this.campaign.name;
      const conn = this.campaign.connection;
      this.selectedConnectionId = typeof conn === 'string' ? conn : conn?._id;
      this.recipientCount = this.campaign.stats?.total || 0;

      this.paramFormState = {
        defaultParams: {},
        varsFromCsv: [],
        headerMedia: this.campaign.headerMedia,
        headerLocation: this.campaign.headerLocation,
        urlButtonParams: this.campaign.urlButtonParams || []
      };

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
          if (this.campaign?.templateRef) {
            const tid =
              typeof this.campaign.templateRef === 'string'
                ? this.campaign.templateRef
                : (this.campaign.templateRef as WhatsAppTemplate)._id;
            if (tid) {
              const match =
                this.templates.find(t => t._id === tid || (t as { id?: string }).id === tid) || null;
              if (match) {
                this.selectedTemplate = match;
                this.refreshTemplateSlots();
              }
            }
          }
        },
        error: () => this.notify.error('Failed to load templates')
      });
  }

  selectTemplate(t: WhatsAppTemplate): void {
    this.selectedTemplate = t;
    const templateKey = t._id ?? (t as WhatsAppTemplate & { id?: string }).id;
    if (!templateKey || !this.createdCampaignId) {
      this.refreshTemplateSlots();
      return;
    }
    // Persist template selection so we can hit /template-slots
    this.campaignService.updateCampaign(this.createdCampaignId, {
      templateRef: templateKey as unknown as ICampaign['templateRef']
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refreshTemplateSlots(),
        error: err => this.notify.error(err?.error?.error || 'Failed to save template selection')
      });
  }

  private refreshTemplateSlots(): void {
    if (!this.createdCampaignId) {
      this.templateSlots = null;
      return;
    }
    this.templateSlotsLoading = true;
    this.campaignService.getTemplateSlots(this.createdCampaignId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.templateSlotsLoading = false)))
      .subscribe({
        next: r => {
          this.templateSlots = r.slots;
          this.csvPreview = null;
          this.csvMapping = null;
        },
        error: () => this.notify.error('Failed to load template slots')
      });
  }

  onParamFormChange(state: TemplateParamFormState): void {
    this.paramFormState = state;
  }

  getBodyText(template: WhatsAppTemplate): string {
    return template.components?.find(c => c.type === 'BODY')?.text || '';
  }

  hasVariables(template: WhatsAppTemplate): boolean {
    const body = template.components?.find(c => c.type === 'BODY');
    return !!body?.text?.includes('{{');
  }

  // ─── Audience ─────────────────────────────────────────────────────────────

  setAudienceTab(tab: 'paste' | 'upload'): void {
    this.audienceTab = tab;
  }

  onUploadedCsvFilesChange(files: File[]): void {
    this.uploadedCsvFiles = files;
    if (!files.length) {
      this.uploadedFileName = '';
      this.rawPhoneText = '';
      this.csvPreview = null;
      this.csvMapping = null;
      return;
    }
    const file = files[0];
    this.uploadedFileName = file.name;

    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || '';
      this.rawPhoneText = text;
      this.cdr.detectChanges();
      // Auto-preview to get headers & suggested mapping
      this.previewCsv();
    };
    reader.readAsText(file);
  }

  previewCsv(): void {
    if (!this.rawPhoneText.trim() || !this.createdCampaignId) return;
    this.audiencePreviewLoading = true;
    this.csvPreview = null;
    this.csvMapping = null;
    this.campaignService.previewRecipientCsv(this.createdCampaignId, this.rawPhoneText)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.audiencePreviewLoading = false)))
      .subscribe({
        next: r => {
          this.csvPreview = r;
        },
        error: err => this.notify.error(err?.error?.error || 'Failed to preview CSV')
      });
  }

  onMappingChange(mapping: ICsvUploadMapping): void {
    this.csvMapping = mapping;
  }

  /** Show the CSV mapper when: upload tab AND template has CSV-mapped vars AND a preview is available. */
  get shouldShowCsvMapper(): boolean {
    return (
      this.audienceTab === 'upload' &&
      !!this.csvPreview &&
      this.hasTemplateVariables &&
      this.paramFormState.varsFromCsv.length > 0
    );
  }

  /** True when at least one slot exists for the current template. */
  get hasTemplateVariables(): boolean {
    if (!this.templateSlots) return false;
    return (
      this.templateSlots.body.slots.length > 0 ||
      this.templateSlots.header.textSlots.length > 0 ||
      this.templateSlots.buttons.length > 0
    );
  }

  submitAudience(): void {
    if (!this.createdCampaignId) {
      this.notify.error('Campaign must be saved first (go to step 1)');
      return;
    }

    if (this.audienceTab === 'upload' && this.shouldShowCsvMapper) {
      // Mapping flow — requires a valid mapping
      if (!this.csvMapping || !this.csvMapping.phoneColumn) {
        this.notify.warning('Please choose a phone column');
        return;
      }
      const missing = this.paramFormState.varsFromCsv.filter(
        k => !this.csvMapping?.slots?.[k]
      );
      if (missing.length > 0) {
        this.notify.warning('Map every CSV variable to a column before continuing');
        return;
      }

      this.audienceLoading = true;
      this.parseResult = null;
      this.campaignService.addRecipientsWithMapping(
        this.createdCampaignId,
        this.rawPhoneText,
        this.csvMapping,
        this.paramFormState.defaultParams
      )
        .pipe(takeUntil(this.destroy$), finalize(() => (this.audienceLoading = false)))
        .subscribe({
          next: r => {
            this.parseResult = r;
            this.recipientCount = r.total;
            this.notify.success(`${r.inserted} recipients added`);
          },
          error: err => this.notify.error(err?.error?.error || 'Failed to add recipients')
        });
      return;
    }

    // Simple flow (paste / no mapping needed)
    if (!this.rawPhoneText.trim()) {
      this.notify.warning('Please enter or upload phone numbers');
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
          this.uploadedCsvFiles = [];
          this.uploadedFileName = '';
          this.csvPreview = null;
          this.csvMapping = null;
          this.parseResult = null;
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
    this.campaignService
      .sendTestMessage(this.createdCampaignId, this.testPhone, this.paramFormState.defaultParams)
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
    if (!this.selectedTemplate) return false;
    if (!this.templateSlots) return false;
    if (this.templateSlots.isUnsupported) return false;
    if (this.templateSlots.isAuth) return false;

    // Header media must be uploaded for IMAGE/VIDEO/DOCUMENT templates
    if (this.templateSlots.header.requiresMedia && !this.paramFormState.headerMedia?.url) {
      return false;
    }
    if (this.templateSlots.header.format === 'LOCATION') {
      const loc = this.paramFormState.headerLocation;
      if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return false;
    }

    // For non-CSV slots, a default value must be supplied (CSV slots are validated in Step 3)
    const allSlots = [
      ...this.templateSlots.header.textSlots,
      ...this.templateSlots.body.slots,
      ...this.templateSlots.buttons.flatMap(b => b.urlVars)
    ];
    for (const slot of allSlots) {
      if (this.paramFormState.varsFromCsv.includes(slot.key)) continue;
      const v = (this.paramFormState.defaultParams[slot.key] || '').trim();
      if (!v) return false;
    }
    return true;
  }

  canProceedStep3(): boolean {
    return this.recipientCount > 0;
  }

  goToPreviousStep(): void {
    switch (this.step) {
      case 1: this.close(); break;
      case 2: this.step = 1; break;
      case 3: this.step = 2; break;
      case 4: this.step = 3; break;
      case 5: this.step = 4; break;
    }
  }

  goToStep(target: Step): void {
    if (target < this.step) {
      this.step = target;
      return;
    }
    if (target === 2 && this.step === 1) this.proceedStep1();
    else if (target === 3 && this.step === 2) this.proceedStep2();
    else if (target === 4 && this.step === 3) this.step = 4;
    else if (target === 5 && this.step === 4) this.step = 5;
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
          connection: this.selectedConnectionId as unknown as ICampaign['connection']
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
      if (this.templateSlots?.isAuth) {
        this.notify.warning('Authentication templates cannot be used for broadcasts.');
      } else if (this.templateSlots?.isUnsupported) {
        this.notify.warning(this.templateSlots.isUnsupported.reason);
      } else if (this.templateSlots?.header.requiresMedia && !this.paramFormState.headerMedia?.url) {
        this.notify.warning('Please upload the header media file first.');
      } else {
        this.notify.warning('Please fill in all required template variables.');
      }
      return;
    }
    this.saving = true;
    this.campaignService.updateCampaign(this.createdCampaignId, {
      headerMedia: this.paramFormState.headerMedia as ICampaignHeaderMedia,
      headerLocation: this.paramFormState.headerLocation as ICampaignHeaderLocation,
      urlButtonParams: this.paramFormState.urlButtonParams as ICampaignUrlButtonParam[]
    })
      .pipe(takeUntil(this.destroy$), finalize(() => (this.saving = false)))
      .subscribe({
        next: () => { this.step = 3; },
        error: err => this.notify.error(err?.error?.error || 'Failed to save template settings')
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
    const updateObs = !this.sendNow && schedDate
      ? this.campaignService.updateCampaign(this.createdCampaignId, {
          scheduledAt: schedDate.toISOString()
        })
      : this.campaignService.updateCampaign(this.createdCampaignId, {
          scheduledAt: null
        });

    updateObs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.campaignService.launchCampaign(this.createdCampaignId)
          .pipe(takeUntil(this.destroy$), finalize(() => (this.launching = false)))
          .subscribe({
            next: r => {
              const isScheduled = r.campaign?.status === 'scheduled';
              this.notify.success(
                isScheduled ? 'Campaign scheduled!' : 'Campaign launched!',
                isScheduled
                  ? `Will send at ${new Date(r.campaign!.scheduledAt!).toLocaleString()}`
                  : `Sending to ${this.recipientCount} recipients`
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
