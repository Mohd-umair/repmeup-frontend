import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { KnowledgeBaseService } from '../../../core/services/knowledge-base.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface KbCreateTemplateField { key: string; value: string; }

@Component({
  selector: 'app-knowledge-base-create',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './knowledge-base-create.component.html',
  styleUrls: ['./knowledge-base-create.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeBaseCreateComponent implements OnInit, OnDestroy {

  activeTab: 'manual' | 'pdf' | 'url' = 'manual';
  submitting = false;

  // ── Manual form ────────────────────────────────────────────────────────────
  manualForm!: FormGroup;
  manualTags: string[] = [];
  manualTagInput = '';
  templateFields: KbCreateTemplateField[] = [{ key: '', value: '' }];

  // ── PDF form ───────────────────────────────────────────────────────────────
  pdfForm!: FormGroup;
  selectedFile: File | null = null;
  pdfTags: string[] = [];
  pdfTagInput = '';

  // ── URL form ───────────────────────────────────────────────────────────────
  urlForm!: FormGroup;
  urlTags: string[] = [];
  urlTagInput = '';
  showCreditConfirmModal = false;
  pendingUrlFormData: any = null;
  readonly wordCountOptions = [1000, 2000, 3000, 4000, 5000];
  readonly tagCountOptions  = [5, 10, 15, 20, 25];

  // ── Static lookup data ─────────────────────────────────────────────────────
  readonly typeOptions = [
    { value: 'faq',          label: 'FAQ',          icon: 'fa-question-circle' },
    { value: 'product_info', label: 'Product Info',  icon: 'fa-box' },
    { value: 'policy',       label: 'Policy',        icon: 'fa-file-contract' },
    { value: 'brand_voice',  label: 'Brand Voice',   icon: 'fa-bullhorn' },
    { value: 'procedure',    label: 'Procedure',     icon: 'fa-tasks' },
    { value: 'general',      label: 'General',       icon: 'fa-info-circle' }
  ];

  readonly typeDescriptions: Record<string, string> = {
    faq:          'Q&A pairs matched when customers ask similar questions.',
    product_info: 'Details about your products or services.',
    policy:       'Rules, T&Cs, or procedures matched when customers ask about policies.',
    brand_voice:  'Tone and style guidelines applied across ALL AI responses — highest impact.',
    procedure:    'Step-by-step processes for agents or customers to follow.',
    general:      'Any other context you want the AI to have available.'
  };

  readonly tooltips = {
    priority:        'How important this entry is vs others (1=low, 10=critical).',
    trainingWeight:  'How likely this entry is included in the AI context window (1=rarely, 10=always).',
    trainingContext: 'Tell the AI when to use this entry. Leave blank for automatic.',
    isTrainingData:  'When checked, included in AI background training jobs.',
    isActive:        'Inactive entries are completely ignored by all AI systems.'
  };

  readonly quickStartTemplates: Record<string, {
    title: string; type: string; category: string;
    tags: string; trainingContext: string;
    fields: KbCreateTemplateField[];
  }> = {
    faq: {
      type: 'faq', category: 'Support',
      title: 'Frequently Asked Questions',
      tags: 'returns, shipping, tracking, FAQ, orders',
      trainingContext: 'Use when customers ask about policies, shipping, returns, or order management.',
      fields: [
        { key: 'Q: What is your return policy?', value: 'A: We accept returns within 30 days of purchase.' },
        { key: 'Q: How long does shipping take?', value: 'A: Standard shipping takes 5–7 business days.' },
        { key: 'Q: How do I track my order?', value: 'A: Use the tracking number emailed to you after dispatch.' }
      ]
    },
    brand_voice: {
      type: 'brand_voice', category: 'Brand',
      title: 'Brand Voice & Tone Guidelines',
      tags: 'tone, brand, voice, guidelines, communication',
      trainingContext: 'Always apply these tone guidelines to every AI response.',
      fields: [
        { key: 'BRAND OVERVIEW', value: 'Our brand voice is friendly, professional, and solution-focused.' },
        { key: 'TONE GUIDELINES', value: '- Greet by name\n- Use positive language\n- Be concise\n- Show empathy first' },
        { key: 'LANGUAGE TO AVOID', value: '- Never say "That\'s not possible"\n- Avoid corporate buzzwords' }
      ]
    },
    policy: {
      type: 'policy', category: 'Policies',
      title: 'Refund & Cancellation Policy',
      tags: 'refund, cancellation, policy, returns, billing',
      trainingContext: 'Use when customers ask about refunds, cancellations, or billing disputes.',
      fields: [
        { key: 'REFUND POLICY', value: '- Full refund within 14 days, no questions asked.\n- No refund after 30 days unless faulty.' },
        { key: 'CANCELLATION POLICY', value: '- Subscriptions can be cancelled anytime from account settings.' }
      ]
    },
    product_info: {
      type: 'product_info', category: 'Products',
      title: 'Products & Services Overview',
      tags: 'products, pricing, features, plans, services',
      trainingContext: 'Use when customers ask about what you offer, pricing, or features.',
      fields: [
        { key: '[Product Name 1]', value: 'Price: $XX/month\nKey feature: [main value]\nBest for: [target customer]' },
        { key: 'KEY DIFFERENTIATORS', value: '- [What makes your product unique]\n- [Main problem you solve]' }
      ]
    },
    procedure: {
      type: 'procedure', category: 'Procedures',
      title: 'How to Reset Your Password',
      tags: 'password, reset, login, account, security',
      trainingContext: 'Use when customers are locked out or need to change their password.',
      fields: [
        { key: 'PASSWORD RESET STEPS', value: 'Step 1: Go to login page\nStep 2: Click "Forgot your password?"\nStep 3: Enter email\nStep 4: Follow reset link in email' },
        { key: 'TROUBLESHOOTING', value: '- Check spam for email\n- Link expires after 30 mins' }
      ]
    },
    general: {
      type: 'general', category: 'General',
      title: 'Company Overview & Contact Information',
      tags: 'contact, hours, address, support, about',
      trainingContext: 'Use when customers ask for contact details, business hours, or company info.',
      fields: [
        { key: 'ABOUT US', value: '[Company Name] was founded in [year] with the mission to [mission].' },
        { key: 'CONTACT INFORMATION', value: 'Support: support@example.com\nPhone: +1 (555) 000-0000\nHours: Mon–Fri, 9AM–6PM EST' }
      ]
    }
  };

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private knowledgeBaseService: KnowledgeBaseService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    this.manualForm = this.fb.group({
      title:           ['', [Validators.required, Validators.minLength(3)]],
      content:         [''],
      type:            ['general'],
      category:        [''],
      priority:        [5, [Validators.min(1), Validators.max(10)]],
      trainingContext: [''],
      trainingWeight:  [5, [Validators.min(1), Validators.max(10)]],
      isTrainingData:  [true],
      isActive:        [true]
    });

    this.pdfForm = this.fb.group({
      title:    [''],
      category: [''],
      priority: [5, [Validators.min(1), Validators.max(10)]]
    });

    this.urlForm = this.fb.group({
      url:             ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      title:           [''],
      category:        [''],
      priority:        [5, [Validators.min(1), Validators.max(10)]],
      targetWordCount: [2000],
      targetTagCount:  [10]
    });
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get selectedTypeDescription(): string {
    const type = this.manualForm?.get('type')?.value;
    return type ? (this.typeDescriptions[type] ?? '') : '';
  }

  get fieldEditorHasContent(): boolean {
    return this.templateFields.some(f => f.value.trim().length > 0);
  }

  get estimatedCredits(): number {
    const words = this.urlForm?.get('targetWordCount')?.value ?? 2000;
    const tags  = this.urlForm?.get('targetTagCount')?.value  ?? 10;
    return Math.min(10, Math.max(1, Math.ceil(words / 500) + Math.ceil(tags / 5)));
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  applyTemplate(key: string): void {
    const tpl = this.quickStartTemplates[key];
    if (!tpl) return;
    this.manualForm.patchValue({
      title: tpl.title, type: tpl.type, category: tpl.category,
      trainingContext: tpl.trainingContext,
      priority: 7, trainingWeight: 7, isTrainingData: true, isActive: true
    });
    this.manualTags   = tpl.tags.split(',').map(t => t.trim()).filter(Boolean);
    this.templateFields = tpl.fields.map(f => ({ ...f }));
    this.manualForm.patchValue({ content: '' });
    this.activeTab = 'manual';
    this.cdr.markForCheck();
  }

  addTemplateField(): void {
    this.templateFields.push({ key: '', value: '' });
  }

  removeTemplateField(index: number): void {
    this.templateFields.splice(index, 1);
  }

  composeContentFromFields(): string {
    return this.templateFields
      .filter(f => f.key.trim() || f.value.trim())
      .map(f => f.key.trim() ? `${f.key.trim()}:\n${f.value.trim()}` : f.value.trim())
      .join('\n\n');
  }

  // ── Tag chip helpers ───────────────────────────────────────────────────────

  onTagKeydown(event: KeyboardEvent, form: 'manual' | 'pdf' | 'url'): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitTag(form);
    } else if (event.key === 'Backspace') {
      const tags = this.getTagArray(form);
      if (!this.getTagInput(form) && tags.length > 0) {
        tags.splice(tags.length - 1, 1);
      }
    }
  }

  commitTag(form: 'manual' | 'pdf' | 'url'): void {
    const raw = this.getTagInput(form).trim().replace(/,+$/, '');
    if (!raw) return;
    const tags = this.getTagArray(form);
    if (!tags.includes(raw)) tags.push(raw);
    this.setTagInput(form, '');
  }

  commitTagOnBlur(form: 'manual' | 'pdf' | 'url'): void {
    this.commitTag(form);
  }

  removeTag(form: 'manual' | 'pdf' | 'url', index: number): void {
    this.getTagArray(form).splice(index, 1);
  }

  private getTagInput(f: 'manual' | 'pdf' | 'url'): string {
    if (f === 'manual') return this.manualTagInput;
    if (f === 'pdf')    return this.pdfTagInput;
    return this.urlTagInput;
  }

  private setTagInput(f: 'manual' | 'pdf' | 'url', v: string): void {
    if (f === 'manual') this.manualTagInput = v;
    else if (f === 'pdf') this.pdfTagInput = v;
    else this.urlTagInput = v;
  }

  private getTagArray(f: 'manual' | 'pdf' | 'url'): string[] {
    if (f === 'manual') return this.manualTags;
    if (f === 'pdf')    return this.pdfTags;
    return this.urlTags;
  }

  // ── File selection ─────────────────────────────────────────────────────────

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      if (!this.pdfForm.get('title')?.value) {
        this.pdfForm.patchValue({ title: file.name.replace('.pdf', '') });
      }
      this.cdr.markForCheck();
    } else {
      this.notificationService.warning('Invalid File', 'Please select a PDF file');
      event.target.value = '';
    }
  }

  // ── Form submissions ───────────────────────────────────────────────────────

  submitManual(): void {
    const composed = this.composeContentFromFields();
    this.manualForm.patchValue({ content: composed });
    if (this.manualForm.get('title')?.invalid || composed.trim().length < 10) return;
    if (this.manualForm.invalid) return;

    this.submitting = true;
    const formData: any = {
      ...this.manualForm.value,
      tags: [...this.manualTags],
      templateFields: this.templateFields.filter(f => f.key.trim() || f.value.trim())
    };

    this.knowledgeBaseService.createManual(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.success('Entry Added', 'Your knowledge base entry is now active.');
            this.router.navigate(['/app/knowledge-base']);
          }
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const msg = err?.error?.error || 'Failed to create knowledge base entry. Please try again.';
          this.notificationService.error('Creation Failed', msg);
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  submitPDF(): void {
    if (!this.selectedFile) {
      this.notificationService.warning('No File Selected', 'Please select a PDF file');
      return;
    }
    this.submitting = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    const fv = this.pdfForm.value;
    if (fv.title)    formData.append('title',    fv.title);
    if (fv.category) formData.append('category', fv.category);
    if (this.pdfTags.length) formData.append('tags', JSON.stringify(this.pdfTags));
    formData.append('priority', fv.priority.toString());

    this.knowledgeBaseService.createFromPDF(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.success('PDF Uploaded', 'Content extracted and added to your knowledge base.');
            this.router.navigate(['/app/knowledge-base']);
          }
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const msg = err?.error?.error || 'Failed to process PDF. Please try again.';
          this.notificationService.error('Upload Failed', msg);
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  openCreditConfirmAndSubmit(): void {
    if (this.urlForm.invalid) return;
    this.pendingUrlFormData = { ...this.urlForm.value };
    this.showCreditConfirmModal = true;
    this.cdr.markForCheck();
  }

  closeCreditConfirmModal(): void {
    this.showCreditConfirmModal = false;
    this.pendingUrlFormData = null;
    this.cdr.markForCheck();
  }

  confirmAndSubmitURL(): void {
    if (!this.pendingUrlFormData) return;
    this.showCreditConfirmModal = false;
    this.submitting = true;
    const payload = { ...this.pendingUrlFormData, tags: [...this.urlTags] };
    this.pendingUrlFormData = null;

    this.knowledgeBaseService.createFromURL(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.success('Imported', 'Entry created from URL successfully.');
            this.router.navigate(['/app/knowledge-base']);
          }
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          const msg = err?.error?.error || 'Failed to import from URL. Please try again.';
          this.notificationService.error('Import Failed', msg);
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/app/knowledge-base']);
  }
}
