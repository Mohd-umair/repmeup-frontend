import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsAppTemplateService } from '../../../core/services/whatsapp-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FileUploadZoneComponent } from '../../../shared/components/file-upload-zone/file-upload-zone.component';
import {
  TemplateCategory,
  TemplateComponent,
  TemplateButton,
  ButtonType,
  HeaderFormat,
  ParameterFormat,
  TEMPLATE_LANGUAGES,
  CreateTemplatePayload
} from '../../../core/models/whatsapp-template.model';

/** Wizard steps */
type Step = 'basics' | 'header' | 'body' | 'footer' | 'buttons' | 'preview';

@Component({
  selector: 'app-template-create',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadZoneComponent],
  templateUrl: './template-create.component.html',
  styleUrls: ['./template-create.component.scss']
})
export class TemplateCreateComponent implements OnInit, OnDestroy {
  @Input() connectionId = '';
  @Output() created = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  // ── Wizard state ──────────────────────────────────────────────────────────
  currentStep: Step = 'basics';
  readonly steps: { id: Step; label: string; icon: string }[] = [
    { id: 'basics',  label: 'Basics',  icon: 'fa-info-circle' },
    { id: 'header',  label: 'Header',  icon: 'fa-heading' },
    { id: 'body',    label: 'Body',    icon: 'fa-align-left' },
    { id: 'footer',  label: 'Footer',  icon: 'fa-paragraph' },
    { id: 'buttons', label: 'Buttons', icon: 'fa-th-large' },
    { id: 'preview', label: 'Preview', icon: 'fa-eye' }
  ];

  // ── Form state ────────────────────────────────────────────────────────────
  name = '';
  category: TemplateCategory = 'MARKETING';
  language = 'en_US';
  parameterFormat: ParameterFormat = 'POSITIONAL';

  // Header
  hasHeader = false;
  headerFormat: HeaderFormat = 'TEXT';
  headerText = '';
  headerMediaHandle = '';

  /** Local file picker + library (IMAGE / VIDEO / DOCUMENT header examples). */
  headerMediaFiles: File[] = [];
  headerUploading = false;
  headerUploadError = '';
  /** Blob URL for preview (image/video). */
  headerMediaPreviewUrl: string | null = null;

  /** True when the current Meta handle came from our upload flow (clearing files clears handle). */
  private headerHandleFromUpload = false;

  // Body
  bodyText = '';
  addSecurityRec = false;
  codeExpiry: number | null = null;

  // Footer
  hasFooter = false;
  footerText = '';

  // Buttons
  hasButtons = false;
  buttons: TemplateButton[] = [];

  // Derived state
  readonly categories: { value: TemplateCategory; label: string; icon: string; iconClass: string; desc: string }[] = [
    {
      value: 'MARKETING',
      label: 'Marketing',
      icon: 'fa-bullhorn',
      iconClass: 'category-card__icon-wrap--marketing',
      desc: 'Promotions, offers, product updates. Requires opt-in.'
    },
    {
      value: 'UTILITY',
      label: 'Utility',
      icon: 'fa-tools',
      iconClass: 'category-card__icon-wrap--utility',
      desc: 'Transactional messages, order updates, alerts.'
    },
    {
      value: 'AUTHENTICATION',
      label: 'Authentication',
      icon: 'fa-shield-alt',
      iconClass: 'category-card__icon-wrap--auth',
      desc: 'One-time passwords and verification codes.'
    }
  ];

  readonly headerFormats: { value: HeaderFormat; label: string; icon: string }[] = [
    { value: 'TEXT',     label: 'Text',     icon: 'fa-font' },
    { value: 'IMAGE',    label: 'Image',    icon: 'fa-image' },
    { value: 'VIDEO',    label: 'Video',    icon: 'fa-video' },
    { value: 'DOCUMENT', label: 'Document', icon: 'fa-file-alt' },
    { value: 'LOCATION', label: 'Location', icon: 'fa-map-marker-alt' }
  ];

  readonly buttonTypes: { value: ButtonType; label: string; icon: string }[] = [
    { value: 'QUICK_REPLY',  label: 'Quick Reply',  icon: 'fa-reply' },
    { value: 'URL',          label: 'Visit URL',    icon: 'fa-external-link-alt' },
    { value: 'PHONE_NUMBER', label: 'Call Phone',   icon: 'fa-phone' },
    { value: 'COPY_CODE',    label: 'Copy Code',    icon: 'fa-copy' },
    { value: 'OTP',          label: 'OTP',          icon: 'fa-key' }
  ];

  readonly languages = TEMPLATE_LANGUAGES;

  // ── Validation ────────────────────────────────────────────────────────────
  validationErrors: string[] = [];

  // ── Submit state ──────────────────────────────────────────────────────────
  submitting = false;
  submitError = '';

  private destroy$ = new Subject<void>();

  constructor(
    private templateService: WhatsAppTemplateService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.category === 'AUTHENTICATION') {
      this._applyAuthDefaults();
    }
  }

  ngOnDestroy(): void {
    this.revokeHeaderPreview();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Step navigation ───────────────────────────────────────────────────────

  get stepIndex(): number {
    return this.steps.findIndex(s => s.id === this.currentStep);
  }

  goToStep(step: Step): void {
    const targetIdx = this.steps.findIndex(s => s.id === step);
    if (targetIdx <= this.stepIndex) {
      this.currentStep = step;
      return;
    }
    if (this._validateCurrentStep()) {
      this.currentStep = step;
    }
  }

  next(): void {
    if (!this._validateCurrentStep()) return;
    const idx = this.stepIndex;
    if (idx < this.steps.length - 1) {
      this.currentStep = this.steps[idx + 1].id;
    }
  }

  back(): void {
    const idx = this.stepIndex;
    if (idx > 0) {
      this.currentStep = this.steps[idx - 1].id;
    }
  }

  isStepComplete(step: Step): boolean {
    const idx = this.steps.findIndex(s => s.id === step);
    return idx < this.stepIndex;
  }

  // ── Category change ───────────────────────────────────────────────────────

  onCategoryChange(): void {
    if (this.category === 'AUTHENTICATION') {
      this._applyAuthDefaults();
    } else {
      this.addSecurityRec = false;
      this.codeExpiry = null;
    }
  }

  /** MEDIA / VIDEO / DOCUMENT header — needs Meta upload handle. */
  isHeaderBinaryFormat(fmt: HeaderFormat = this.headerFormat): boolean {
    return fmt === 'IMAGE' || fmt === 'VIDEO' || fmt === 'DOCUMENT';
  }

  selectHeaderFormat(fmt: HeaderFormat): void {
    if (fmt === this.headerFormat) return;
    this.resetHeaderMediaFields();
    this.headerFormat = fmt;
  }

  get headerUploadAccept(): string {
    switch (this.headerFormat) {
      case 'IMAGE':
        return 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png';
      case 'VIDEO':
        return 'video/mp4,.mp4';
      case 'DOCUMENT':
        return 'application/pdf,.pdf';
      default:
        return '*/*';
    }
  }

  get headerUploadGalleryType(): 'image' | 'video' | 'all' {
    if (this.headerFormat === 'IMAGE') return 'image';
    if (this.headerFormat === 'VIDEO') return 'video';
    return 'all';
  }

  get headerUploadHint(): string {
    switch (this.headerFormat) {
      case 'IMAGE':
        return 'JPEG or PNG · Example shown in Meta template review.';
      case 'VIDEO':
        return 'MP4 only (Meta requirement).';
      case 'DOCUMENT':
        return 'PDF only — use your device or a stored PDF.';
      default:
        return '';
    }
  }

  revokeHeaderPreview(): void {
    if (this.headerMediaPreviewUrl) {
      URL.revokeObjectURL(this.headerMediaPreviewUrl);
      this.headerMediaPreviewUrl = null;
    }
  }

  resetHeaderMediaFields(): void {
    this.revokeHeaderPreview();
    this.headerMediaFiles = [];
    this.headerMediaHandle = '';
    this.headerHandleFromUpload = false;
    this.headerUploadError = '';
  }

  onHeaderHandleModelChange(): void {
    this.headerHandleFromUpload = false;
  }

  onHeaderMediaFilesChange(files: File[]): void {
    this.headerMediaFiles = files;
    this.headerUploadError = '';
    this.revokeHeaderPreview();

    if (!files.length) {
      if (this.headerHandleFromUpload) {
        this.headerMediaHandle = '';
        this.headerHandleFromUpload = false;
      }
      return;
    }

    const file = files[0];
    this.headerMediaPreviewUrl = URL.createObjectURL(file);

    void this.uploadHeaderMediaFile(file);
  }

  private uploadHeaderMediaFile(file: File): void {
    if (!this.connectionId) {
      this.notificationService.warning(
        'WhatsApp connection',
        'Pick a WhatsApp connection on the templates page before uploading.'
      );
      return;
    }

    this.headerUploading = true;
    this.headerUploadError = '';

    this.templateService
      .uploadHeaderExample(this.connectionId, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.headerUploading = false;
          if (!res?.success || !res.handle) {
            this.notificationService.error('Upload failed', 'Meta did not return a file handle.');
            return;
          }
          this.headerMediaHandle = res.handle;
          this.headerHandleFromUpload = true;
          if (res.suggestedHeaderFormat && res.suggestedHeaderFormat !== this.headerFormat) {
            this.headerFormat = res.suggestedHeaderFormat as HeaderFormat;
          }
          this.notificationService.success(
            'Ready for Meta',
            'Example media uploaded. You can continue the wizard or submit when ready.'
          );
        },
        error: (err) => {
          this.headerUploading = false;
          const msg = err?.error?.error || err?.message || 'Could not upload to Meta.';
          this.headerUploadError = msg;
          this.headerMediaHandle = '';
          this.headerHandleFromUpload = false;
          this.notificationService.error('Upload failed', msg);
        }
      });
  }

  private _applyAuthDefaults(): void {
    // Auth templates have pre-set body by Meta; we enable security recommendation
    this.addSecurityRec = true;
    this.codeExpiry = 10;
    this.hasHeader = false;
    this.hasFooter = false;
    // Ensure OTP button is set
    if (!this.buttons.find(b => b.type === 'COPY_CODE' || b.type === 'OTP')) {
      this.hasButtons = true;
      this.buttons = [{ type: 'COPY_CODE', text: 'Copy Code' }];
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────

  addButton(): void {
    if (this.buttons.length >= 10) return;
    this.buttons.push({ type: 'QUICK_REPLY', text: '' });
  }

  removeButton(idx: number): void {
    this.buttons.splice(idx, 1);
  }

  onButtonTypeChange(idx: number): void {
    const btn = this.buttons[idx];
    // Reset fields on type change
    btn.text = '';
    btn.url = undefined;
    btn.phone_number = undefined;
    btn.otp_type = undefined;
    if (btn.type === 'OTP') btn.otp_type = 'COPY_CODE';
  }

  // ── Body helpers ──────────────────────────────────────────────────────────

  get bodyCharCount(): number {
    return this.bodyText.length;
  }

  get footerCharCount(): number {
    return this.footerText.length;
  }

  get headerCharCount(): number {
    return this.headerText.length;
  }

  /** Meta allows at most one variable in a TEXT header. */
  get headerVariableCount(): number {
    if (this.parameterFormat === 'NAMED') {
      return (this.headerText.match(/\{\{([a-z0-9_]+)\}\}/gi) || []).length;
    }
    return (this.headerText.match(/\{\{\d+\}\}/g) || []).length;
  }

  get canInsertHeaderVariable(): boolean {
    return this.headerFormat === 'TEXT' && this.headerVariableCount < 1;
  }

  get headerVariableHint(): string {
    if (this.parameterFormat === 'NAMED') {
      return 'Named: {{customer_name}} — one variable max';
    }
    return 'Positional: {{1}} — one variable max';
  }

  insertVariable(): void {
    if (this.parameterFormat === 'NAMED') {
      this.bodyText += '{{variable_name}}';
    } else {
      const count = (this.bodyText.match(/\{\{\d+\}\}/g) || []).length;
      this.bodyText += `{{${count + 1}}}`;
    }
  }

  insertHeaderVariable(): void {
    if (!this.canInsertHeaderVariable) {
      this.notificationService.warning(
        'Header variable limit',
        'Text headers support only one variable.'
      );
      return;
    }
    if (this.parameterFormat === 'NAMED') {
      this.headerText += '{{variable_name}}';
    } else {
      this.headerText += '{{1}}';
    }
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  get previewBody(): string {
    if (this.category === 'AUTHENTICATION') {
      return '*123456* is your verification code.';
    }
    return this.bodyText || '(Body text not set)';
  }

  get previewHeader(): string {
    if (!this.headerText) return 'Header text';
    let text = this.headerText;
    if (this.parameterFormat === 'NAMED') {
      for (const p of this._extractNamedParams(this.headerText)) {
        const re = new RegExp(`\\{\\{\\s*${p.param_name}\\s*\\}\\}`, 'gi');
        text = text.replace(re, p.example);
      }
    } else {
      text = text.replace(/\{\{\s*\d+\s*\}\}/g, 'Example');
    }
    return text;
  }

  get previewButtons(): TemplateButton[] {
    return this.hasButtons ? this.buttons : [];
  }

  // ── Build payload ─────────────────────────────────────────────────────────

  buildComponents(): TemplateComponent[] {
    const comps: TemplateComponent[] = [];

    if (this.hasHeader && this.category !== 'AUTHENTICATION') {
      const comp: TemplateComponent = { type: 'HEADER', format: this.headerFormat };
      if (this.headerFormat === 'TEXT') {
        comp.text = this.headerText;
        if (this.headerText.includes('{{')) {
          if (this.parameterFormat === 'NAMED') {
            comp.example = {
              header_text_named_params: this._extractNamedParams(this.headerText)
            };
          } else {
            comp.example = { header_text: ['Example'] };
          }
        }
      } else if (this.headerMediaHandle) {
        comp.example = { header_handle: [this.headerMediaHandle] };
      }
      comps.push(comp);
    }

    if (this.category !== 'AUTHENTICATION') {
      const body: TemplateComponent = { type: 'BODY', text: this.bodyText };
      if (this.bodyText.includes('{{')) {
        if (this.parameterFormat === 'NAMED') {
          body.example = {
            body_text_named_params: this._extractNamedParams(this.bodyText)
          };
        } else {
          const count = (this.bodyText.match(/\{\{\d+\}\}/g) || []).length;
          body.example = {
            body_text: [Array(count).fill('Example')]
          };
        }
      }
      if (this.addSecurityRec) body.add_security_recommendation = true;
      if (this.codeExpiry) body.code_expiration_minutes = this.codeExpiry;
      comps.push(body);
    }

    if (this.hasFooter && this.footerText && this.category !== 'AUTHENTICATION') {
      comps.push({ type: 'FOOTER', text: this.footerText });
    }

    if (this.hasButtons && this.buttons.length > 0) {
      comps.push({ type: 'BUTTONS', buttons: this.buttons });
    }

    return comps;
  }

  private _extractNamedParams(text: string): { param_name: string; example: string }[] {
    const matches = text.match(/\{\{([a-z0-9_]+)\}\}/gi) || [];
    const seen = new Set<string>();
    const out: { param_name: string; example: string }[] = [];
    for (const m of matches) {
      const param_name = m.replace(/[{}]/g, '').toLowerCase();
      if (seen.has(param_name)) continue;
      seen.add(param_name);
      out.push({ param_name, example: 'example_value' });
    }
    return out;
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private _validateCurrentStep(): boolean {
    this.validationErrors = [];

    switch (this.currentStep) {
      case 'basics':
        if (!this.name) this.validationErrors.push('Template name is required.');
        else if (!/^[a-z0-9_]+$/.test(this.name)) {
          this.validationErrors.push('Name must be lowercase alphanumeric with underscores.');
        }
        if (!this.language) this.validationErrors.push('Language is required.');
        break;

      case 'header':
        if (this.hasHeader && this.headerFormat === 'TEXT' && !this.headerText) {
          this.validationErrors.push('Header text is required when header type is Text.');
        }
        if (this.hasHeader && this.headerFormat === 'TEXT' && this.headerText.length > 60) {
          this.validationErrors.push('Header text must be 60 characters or fewer.');
        }
        if (this.hasHeader && this.headerFormat === 'TEXT' && this.headerVariableCount > 1) {
          this.validationErrors.push('Text headers support only one variable.');
        }
        if (this.hasHeader && this.isHeaderBinaryFormat() && !this.headerMediaHandle) {
          this.validationErrors.push('Upload example media (or paste a Meta handle) for this header type.');
        }
        break;

      case 'body':
        if (this.category !== 'AUTHENTICATION' && !this.bodyText) {
          this.validationErrors.push('Body text is required.');
        }
        if (this.bodyText.length > 1024) {
          this.validationErrors.push('Body must be 1024 characters or fewer.');
        }
        break;

      case 'footer':
        if (this.hasFooter && !this.footerText) {
          this.validationErrors.push('Footer text is required when footer is enabled.');
        }
        if (this.footerText.length > 60) {
          this.validationErrors.push('Footer must be 60 characters or fewer.');
        }
        break;

      case 'buttons':
        if (this.hasButtons) {
          this.buttons.forEach((btn, i) => {
            if (!btn.text) this.validationErrors.push(`Button ${i + 1}: Text is required.`);
            if (btn.type === 'URL' && !btn.url) {
              this.validationErrors.push(`Button ${i + 1}: URL is required.`);
            }
            if (btn.type === 'PHONE_NUMBER' && !btn.phone_number) {
              this.validationErrors.push(`Button ${i + 1}: Phone number is required.`);
            }
            if (btn.type === 'QUICK_REPLY' && (btn.text?.length || 0) > 25) {
              this.validationErrors.push(`Button ${i + 1}: Quick reply text max 25 chars.`);
            }
          });
        }
        break;
    }

    return this.validationErrors.length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  submit(): void {
    this.submitError = '';
    this.validationErrors = [];

    const payload: CreateTemplatePayload = {
      connectionId: this.connectionId || undefined,
      name: this.name,
      category: this.category,
      language: this.language,
      parameter_format: this.parameterFormat,
      components: this.buildComponents()
    };

    this.submitting = true;
    this.templateService.createTemplate(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.created.emit();
        },
        error: (err) => {
          this.submitting = false;
          const data = err?.error;
          if (data?.details) {
            this.validationErrors = data.details;
          } else {
            this.submitError = data?.error || 'Failed to create template. Please try again.';
          }
        }
      });
  }
}
