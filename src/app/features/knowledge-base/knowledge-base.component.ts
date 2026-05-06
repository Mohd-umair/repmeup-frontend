import { Component, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { KnowledgeBaseService, IKnowledgeBase, IKbListAnalytics } from '../../core/services/knowledge-base.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { SimpleDonutChartComponent, DonutSegment } from '../../shared/components/charts/simple-donut-chart.component';
import { NotificationService } from '../../core/services/notification.service';
import { SweetAlertService } from '../../core/services/sweet-alert.service';
import { AiChatBubbleIconComponent } from '../../shared/components/ai-chat-bubble-icon/ai-chat-bubble-icon.component';

export interface KbTemplateField { key: string; value: string; }

@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DecimalPipe, PaginationComponent, SimpleDonutChartComponent, AiChatBubbleIconComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrls: ['./knowledge-base.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeBaseComponent implements OnInit, OnDestroy {
  // UI State
  activeTab: 'list' | 'manual' | 'pdf' | 'url' = 'list';
  showUsageBanner = false;
  showAddMenu = false;
  selectedEntry: IKnowledgeBase | null = null;
  showReadModal = false;
  readModalLoading = false;
  loading = false;
  submitting = false;

  // Edit mode
  isEditMode = false;
  editingEntryId: string | null = null;

  /** Key / value rows — composed to `content` on save */
  templateFields: KbTemplateField[] = [];

  /** Analytics sidebar */
  kbInsightsTab: 'overview' | 'breakdown' = 'overview';

  // Data (list = current server page)
  categories: string[] = [];
  filteredKnowledgeBase: IKnowledgeBase[] = [];
  kbAnalytics: IKbListAnalytics | null = null;

  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  // Cached donut segments — updated only when kbAnalytics changes, not on every CD tick
  usageDonutSegments: DonutSegment[] = [];

  // Reactive search stream
  private readonly searchInput$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  // switchMap stream that cancels stale requests
  private readonly listRequest$ = new Subject<Record<string, string | number>>();

  // Forms
  manualForm!: FormGroup;
  pdfForm!: FormGroup;
  urlForm!: FormGroup;
  selectedFile: File | null = null;

  // Chip/tag inputs — managed outside the FormGroup
  manualTags: string[] = [];
  manualTagInput = '';
  pdfTags: string[] = [];
  pdfTagInput = '';
  urlTags: string[] = [];
  urlTagInput = '';

  // Filters
  searchTerm = '';
  filterCategory = '';
  filterSource = '';

  // URL form options
  wordCountOptions = [1000, 2000, 3000, 4000, 5000];
  tagCountOptions = [5, 10, 15, 20, 25];
  showCreditConfirmModal = false;
  pendingUrlFormData: any = null;

  readonly typeOptions = [
    { value: 'faq',          label: 'FAQ',          icon: 'fa-question-circle' },
    { value: 'product_info', label: 'Product Info',  icon: 'fa-box' },
    { value: 'policy',       label: 'Policy',        icon: 'fa-file-contract' },
    { value: 'brand_voice',  label: 'Brand Voice',   icon: 'fa-bullhorn' },
    { value: 'procedure',    label: 'Procedure',     icon: 'fa-tasks' },
    { value: 'general',      label: 'General',       icon: 'fa-info-circle' }
  ];

  readonly sourceOptions = [
    { value: 'manual', label: 'Manual Entry', icon: 'fa-keyboard' },
    { value: 'pdf',    label: 'PDF Upload',   icon: 'fa-file-pdf' },
    { value: 'url',    label: 'Website URL',  icon: 'fa-globe' }
  ];

  /** Contextual descriptions for each entry type */
  readonly typeDescriptions: Record<string, string> = {
    faq:          'Q&A pairs matched when customers ask similar questions.',
    product_info: 'Details about your products or services; used when customers ask what you offer.',
    policy:       'Rules, T&Cs, or procedures matched when customers ask about policies.',
    brand_voice:  'Tone and style guidelines applied across ALL AI responses — highest impact.',
    procedure:    'Step-by-step processes for agents or customers to follow.',
    general:      'Any other context you want the AI to have available.'
  };

  /** Tooltip texts for complex fields */
  readonly tooltips = {
    priority:        'How important this entry is vs. others (1 = low, 10 = critical). Higher priority entries appear first in search results.',
    trainingWeight:  'How likely this entry is to be included in the AI context window when space is limited (1 = rarely included, 10 = always included). Brand Voice entries should be 9–10.',
    trainingContext: 'Tell the AI when to use this entry, e.g. "Use when a customer asks about returns". Leave blank to let the AI decide automatically.',
    isTrainingData:  'When checked, this entry is included in AI background training jobs. Uncheck for entries that are only for keyword matching.',
    isActive:        'Inactive entries are completely ignored by all AI systems — auto-replies, inbox assist, and background jobs.'
  };

  /** Quick-start templates for all 6 types */
  readonly quickStartTemplates: Record<string, {
    title: string; type: string; category: string;
    tags: string; trainingContext: string;
    fields: KbTemplateField[];
  }> = {
    faq: {
      type: 'faq', category: 'Support',
      title: 'Frequently Asked Questions',
      tags: 'returns, shipping, tracking, FAQ, orders',
      trainingContext: 'Use when customers ask about policies, shipping, returns, or order management.',
      fields: [
        { key: 'Q: What is your return policy?', value: 'A: We accept returns within 30 days of purchase. Items must be unused and in original packaging. Contact support@example.com to initiate a return.' },
        { key: 'Q: How long does shipping take?', value: 'A: Standard shipping takes 5–7 business days. Express shipping (2–3 days) is available at checkout.' },
        { key: 'Q: How do I track my order?', value: 'A: Once shipped, you will receive a tracking number by email. Use it at our website or the carrier\'s tracking portal.' },
        { key: 'Q: Do you offer international shipping?', value: 'A: Yes, we ship to over 50 countries. International shipping takes 7–14 business days.' },
      ]
    },

    brand_voice: {
      type: 'brand_voice', category: 'Brand',
      title: 'Brand Voice & Tone Guidelines',
      tags: 'tone, brand, voice, guidelines, communication',
      trainingContext: 'Always apply these tone guidelines to every AI response regardless of context.',
      fields: [
        { key: 'BRAND OVERVIEW', value: 'Our brand voice is friendly, professional, and solution-focused.' },
        { key: 'TONE GUIDELINES', value: '- Always greet the customer by name when available\n- Use positive language: "I can help with…" instead of "I can\'t do…"\n- Be concise — avoid long paragraphs; use bullet points when listing options\n- Avoid jargon; use plain, accessible language\n- Show empathy before offering solutions ("I understand how frustrating that must be…")\n- End every interaction with an offer to help further ("Is there anything else I can help you with?")' },
        { key: 'LANGUAGE TO AVOID', value: '- Never say "That\'s not possible" — say "Let me find an alternative for you"\n- Never say "You need to…" — say "You can…" or "One option is…"\n- Avoid corporate buzzwords like "leverage", "synergy", "ecosystem"' },
        { key: 'FORMATTING', value: '- Keep responses under 150 words unless detailed explanation is needed\n- Use numbered lists for step-by-step instructions\n- Bold key information the customer needs to act on' },
      ]
    },

    policy: {
      type: 'policy', category: 'Policies',
      title: 'Refund & Cancellation Policy',
      tags: 'refund, cancellation, policy, returns, billing',
      trainingContext: 'Use when customers ask about refunds, cancellations, damaged goods, or billing disputes.',
      fields: [
        { key: 'REFUND POLICY', value: '- Full refund within 14 days of purchase, no questions asked.\n- Partial refund (50%) between 15–30 days if item is unused and in original condition.\n- No refund after 30 days unless the item is faulty or damaged.\n- Digital products are non-refundable once downloaded.' },
        { key: 'CANCELLATION POLICY', value: '- Subscriptions can be cancelled at any time from your account settings under "Billing".\n- Cancellation takes effect at the end of the current billing period.\n- No partial refunds for unused subscription time remaining.\n- Annual subscriptions cancelled within 14 days receive a full refund.' },
        { key: 'FAULTY OR DAMAGED ITEMS', value: '- Report within 7 days of receipt with photos to support@example.com.\n- We will replace or fully refund at no extra charge, including return shipping.\n- Do not return faulty items without contacting support first.' },
      ]
    },

    product_info: {
      type: 'product_info', category: 'Products',
      title: 'Products & Services Overview',
      tags: 'products, pricing, features, plans, services',
      trainingContext: 'Use when customers ask about what you offer, pricing, features, or how products compare.',
      fields: [
        { key: '[Product Name 1]', value: 'Price: $XX/month\nKey feature: [describe main value]\nBest for: [target customer]\nIncludes: [list key inclusions]' },
        { key: '[Product Name 2]', value: 'Price: $XX/month\nKey feature: [describe main value]\nBest for: [target customer]\nIncludes: [list key inclusions]' },
        { key: '[Product Name 3]', value: 'Price: $XX/month\nKey feature: [describe main value]\nBest for: [target customer]\nIncludes: [list key inclusions]' },
        { key: 'KEY DIFFERENTIATORS', value: '- [What makes your product unique vs competitors]\n- [Main problem you solve]\n- [Key technology or approach]' },
        { key: 'PRICING & PLANS', value: 'Free tier: [what\'s included]\nStarter: $X/month — [description]\nPro: $X/month — [description]\nEnterprise: Custom pricing — contact sales@example.com' },
      ]
    },

    procedure: {
      type: 'procedure', category: 'Procedures',
      title: 'How to Reset Your Password',
      tags: 'password, reset, login, account, security',
      trainingContext: 'Use when customers are locked out of their account or need to change their password.',
      fields: [
        { key: 'PASSWORD RESET STEPS', value: 'Step 1: Go to the login page at app.example.com/login\nStep 2: Click "Forgot your password?" below the login button\nStep 3: Enter the email address associated with your account\nStep 4: Check your inbox for a password reset email (check spam if not received within 2 minutes)\nStep 5: Click the reset link in the email — it expires after 30 minutes\nStep 6: Enter your new password (minimum 8 characters, must include one number)\nStep 7: Confirm your new password and click "Save"\nStep 8: Log in with your new credentials' },
        { key: 'TROUBLESHOOTING', value: '- Did not receive email: Check spam/junk folder; ensure you used the correct email address\n- Link expired: Repeat the process to generate a new link\n- Still locked out: Contact support@example.com with your account email' },
        { key: 'SECURITY NOTE', value: 'Do not share your reset link with anyone, including support staff.' },
      ]
    },

    general: {
      type: 'general', category: 'General',
      title: 'Company Overview & Contact Information',
      tags: 'contact, hours, address, support, about',
      trainingContext: 'Use when customers ask for contact details, business hours, or general company information.',
      fields: [
        { key: 'ABOUT US', value: '[Company Name] was founded in [year] with the mission to [mission statement].\nWe serve [target market] with [core offering].' },
        { key: 'CONTACT INFORMATION', value: 'General support: support@example.com | Response within 24 hours\nSales enquiries: sales@example.com | Response within 4 hours (business hours)\nPhone: +1 (555) 000-0000 | Monday–Friday, 9 AM–6 PM EST\nLive chat: Available on our website 24/7' },
        { key: 'BUSINESS HOURS', value: 'Monday to Friday: 9:00 AM – 6:00 PM EST\nSaturday: 10:00 AM – 2:00 PM EST\nSunday: Closed\nPublic holidays: Closed (responses next business day)' },
        { key: 'OFFICE ADDRESS', value: '[Street Address], [City], [State], [ZIP], [Country]' },
        { key: 'SOCIAL MEDIA', value: 'Twitter/X: @example\nLinkedIn: linkedin.com/company/example\nInstagram: @example' },
      ]
    }
  };

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private knowledgeBaseService: KnowledgeBaseService,
    private notificationService: NotificationService,
    private sweetAlertService: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.initListStream();
    this.initSearchDebounce();
    this.loadKnowledgeBase();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** All HTTP list requests funnelled through switchMap — cancels any in-flight request. */
  private initListStream(): void {
    this.listRequest$
      .pipe(
        switchMap((params) => this.knowledgeBaseService.getAllKnowledgeBase(params)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.filteredKnowledgeBase = response.data || [];
            if (response.pagination) {
              this.totalItems = response.pagination.total;
              this.totalPages = response.pagination.pages;
              this.currentPage = response.pagination.page;
              this.pageSize = response.pagination.limit;
            }
            if (response.analytics) {
              this.kbAnalytics = response.analytics;
              this.rebuildDonutSegments();
            }
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /** 400 ms debounce on the search box — does not fire mid-word. */
  private initSearchDebounce(): void {
    this.searchInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.dispatchListRequest();
      });
  }

  private readonly usageDonutPalette = [
    '#a3e635', '#60a5fa', '#f87171', '#fbbf24',
    '#c084fc', '#34d399', '#fb923c', '#38bdf8'
  ];

  /** Rebuild cached donut arrays only when analytics payload changes. */
  private rebuildDonutSegments(): void {
    const a = this.kbAnalytics;
    if (!a) {
      this.usageDonutSegments = [];
      return;
    }

    // ── Usage distribution (top-8 entries + "Others") ──
    const topUsed = (a.topUsed || []).filter((e) => (e.usageCount ?? 0) > 0);
    const topSum = topUsed.reduce((s, e) => s + (e.usageCount ?? 0), 0);
    const othersCount = Math.max(0, (a.totalUsage ?? 0) - topSum);

    const segments: DonutSegment[] = topUsed.map((e, i) => ({
      label: e.title || '?',
      value: e.usageCount ?? 0,
      color: this.usageDonutPalette[i % this.usageDonutPalette.length]
    }));

    if (othersCount > 0) {
      segments.push({ label: 'Others', value: othersCount, color: '#6b7280' });
    }

    this.usageDonutSegments = segments;
  }

  /** Compose request params and push onto the switchMap stream. */
  private dispatchListRequest(): void {
    this.loading = true;
    const params: Record<string, string | number> = {
      page: this.currentPage,
      limit: this.pageSize
    };
    if (this.filterCategory) params['category'] = this.filterCategory;
    if (this.filterSource)   params['source']   = this.filterSource;
    const q = this.searchTerm.trim();
    if (q) params['search'] = q;
    this.listRequest$.next(params);
  }

  initForms(): void {
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
      url:            ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      title:          [''],
      category:       [''],
      priority:       [5, [Validators.min(1), Validators.max(10)]],
      targetWordCount:[2000],
      targetTagCount: [10]
    });
  }

  // ─── Tag chip input ────────────────────────────────────────────────────────

  onTagKeydown(event: KeyboardEvent, form: 'manual' | 'pdf' | 'url'): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitTag(form);
    } else if (event.key === 'Backspace') {
      const input = this.getTagInput(form);
      const tags  = this.getTagArray(form);
      if (!input && tags.length > 0) {
        this.removeTag(form, tags.length - 1);
      }
    }
  }

  commitTag(form: 'manual' | 'pdf' | 'url'): void {
    const raw = this.getTagInput(form).trim().replace(/,+$/, '');
    if (!raw) return;
    const tags = this.getTagArray(form);
    if (!tags.includes(raw)) {
      tags.push(raw);
    }
    this.setTagInput(form, '');
  }

  commitTagOnBlur(form: 'manual' | 'pdf' | 'url'): void {
    this.commitTag(form);
  }

  removeTag(form: 'manual' | 'pdf' | 'url', index: number): void {
    this.getTagArray(form).splice(index, 1);
  }

  private getTagInput(form: 'manual' | 'pdf' | 'url'): string {
    if (form === 'manual') return this.manualTagInput;
    if (form === 'pdf')    return this.pdfTagInput;
    return this.urlTagInput;
  }

  private setTagInput(form: 'manual' | 'pdf' | 'url', value: string): void {
    if (form === 'manual') this.manualTagInput = value;
    else if (form === 'pdf') this.pdfTagInput = value;
    else this.urlTagInput = value;
  }

  private getTagArray(form: 'manual' | 'pdf' | 'url'): string[] {
    if (form === 'manual') return this.manualTags;
    if (form === 'pdf')    return this.pdfTags;
    return this.urlTags;
  }

  // ─── Computed helpers ──────────────────────────────────────────────────────

  get selectedTypeDescription(): string {
    const type = this.manualForm?.get('type')?.value;
    return type ? (this.typeDescriptions[type] ?? '') : '';
  }

  // ─── KB Analytics (org-wide from API aggregation) ───────────────────────────

  get kbActiveEntries(): number {
    return this.kbAnalytics?.activeCount ?? 0;
  }
  get kbInactiveEntries(): number {
    return this.kbAnalytics?.inactiveCount ?? 0;
  }
  get kbNeverUsedEntries(): number {
    return this.kbAnalytics?.neverUsedEntries ?? 0;
  }
  get kbTotalUsage(): number {
    return this.kbAnalytics?.totalUsage ?? 0;
  }
  get kbTopUsed(): IKnowledgeBase[] {
    return (this.kbAnalytics?.topUsed || []) as IKnowledgeBase[];
  }
  get kbTopTags(): Array<{ tag: string; count: number }> {
    return this.kbAnalytics?.topTags || [];
  }
  get kbAvgTrainingWeight(): number {
    return this.kbAnalytics?.avgTrainingWeight ?? 0;
  }
  get kbHighWeightCount(): number {
    return this.kbAnalytics?.highWeightCount ?? 0;
  }
  get kbMidWeightCount(): number {
    return this.kbAnalytics?.midWeightCount ?? 0;
  }
  get kbLowWeightCount(): number {
    return this.kbAnalytics?.lowWeightCount ?? 0;
  }

  // ─────────────────────────────────────────────────────────────────────────

  getTypeLabel(type: string | undefined): string {
    if (!type) return '—';
    const opt = this.typeOptions.find(o => o.value === type);
    return opt?.label ?? type;
  }

  get estimatedCredits(): number {
    const words = this.urlForm?.get('targetWordCount')?.value ?? 2000;
    const tags  = this.urlForm?.get('targetTagCount')?.value  ?? 10;
    return Math.min(10, Math.max(1, Math.ceil(words / 500) + Math.ceil(tags / 5)));
  }

  // ─── Templates & field editor ─────────────────────────────────────────────

  applyTemplate(key: string): void {
    const tpl = this.quickStartTemplates[key];
    if (!tpl) return;
    this.manualForm.patchValue({
      title: tpl.title, type: tpl.type, category: tpl.category,
      trainingContext: tpl.trainingContext,
      priority: 7, trainingWeight: 7, isTrainingData: true, isActive: true
    });
    this.manualTags = tpl.tags.split(',').map(t => t.trim()).filter(Boolean);
    this.templateFields = tpl.fields.map(f => ({ ...f }));
    this.manualForm.patchValue({ content: '' });
    this.activeTab = 'manual';
  }

  /** Navigate to the dedicated create page */
  navigateToCreate(): void {
    this.showAddMenu = false;
    this.router.navigate(['/app/knowledge-base/create']);
  }

  /** New manual entry from Add menu or empty state */
  openManualEntry(): void {
    this.showAddMenu = false;
    this.isEditMode = false;
    this.editingEntryId = null;
    this.manualForm.reset({
      type: 'general',
      priority: 5,
      trainingWeight: 5,
      isTrainingData: true,
      isActive: true
    });
    this.manualTags = [];
    this.manualTagInput = '';
    this.resetManualContentFields();
    this.activeTab = 'manual';
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

  get fieldEditorHasContent(): boolean {
    return this.templateFields.some(f => f.value.trim().length > 0);
  }

  private parseContentToFields(content: string): KbTemplateField[] {
    const blocks = content.split(/\n{2,}/);
    return blocks
      .map(block => {
        const match = block.match(/^([^\n:]+):\n([\s\S]*)$/);
        if (match) return { key: match[1].trim(), value: match[2].trim() };
        return { key: '', value: block.trim() };
      })
      .filter(f => f.key || f.value);
  }

  resetManualContentFields(): void {
    this.templateFields = [{ key: '', value: '' }];
    this.manualForm.patchValue({ content: '' });
  }

  // ─── Edit entry ───────────────────────────────────────────────────────────

  openEditEntry(entry: IKnowledgeBase): void {
    this.isEditMode = true;
    this.editingEntryId = entry._id;
    this.manualForm.patchValue({
      title:           entry.title,
      type:            entry.type,
      category:        entry.category || '',
      priority:        entry.priority,
      trainingContext: entry.trainingContext || '',
      trainingWeight:  entry.trainingWeight,
      isTrainingData:  entry.isTrainingData,
      isActive:        entry.isActive
    });
    this.manualTags    = [...(entry.tags || [])];
    this.manualTagInput = '';

    if (entry.templateFields && entry.templateFields.length > 0) {
      this.templateFields = entry.templateFields.map(f => ({ ...f }));
    } else {
      const parsed = this.parseContentToFields(entry.content || '');
      this.templateFields =
        parsed.length > 0 ? parsed : [{ key: '', value: (entry.content || '').trim() }];
    }
    this.manualForm.patchValue({ content: '' });
    this.activeTab = 'manual';
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.isEditMode     = false;
    this.editingEntryId = null;
    this.manualForm.reset({ type: 'general', priority: 5, trainingWeight: 5, isTrainingData: true, isActive: true });
    this.manualTags     = [];
    this.manualTagInput = '';
    this.resetManualContentFields();
    this.activeTab = 'list';
  }

  /** Unified cancel for the manual form — handles both create and edit modes */
  cancelManualForm(): void {
    if (this.isEditMode) {
      this.cancelEdit();
    } else {
      this.activeTab = 'list';
      this.resetManualContentFields();
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  loadKnowledgeBase(): void {
    this.dispatchListRequest();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.dispatchListRequest();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.dispatchListRequest();
  }

  loadCategories(): void {
    this.knowledgeBaseService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.categories = response.data || [];
            this.cdr.markForCheck();
          }
        }
      });
  }

  /** Called by search input ngModelChange — pushes into the debounce stream only. */
  onSearchInput(value: string): void {
    this.searchTerm = value;
    this.searchInput$.next(value);
  }

  /** Called by category / source select ngModelChange — fires immediately (no debounce). */
  applyFilters(): void {
    this.currentPage = 1;
    this.dispatchListRequest();
  }

  clearListFilters(): void {
    this.searchTerm = '';
    this.filterCategory = '';
    this.filterSource = '';
    this.currentPage = 1;
    this.dispatchListRequest();
  }

  // ─── Form submissions ─────────────────────────────────────────────────────

  submitManual(): void {
    const composed = this.composeContentFromFields();
    this.manualForm.patchValue({ content: composed });
    const titleCtrl = this.manualForm.get('title');
    if (titleCtrl?.invalid || composed.trim().length < 10) return;
    if (this.manualForm.invalid) return;
    this.submitting = true;
    const formData: any = {
      ...this.manualForm.value,
      tags: [...this.manualTags],
      templateFields: this.templateFields.filter(f => f.key.trim() || f.value.trim())
    };

    if (this.isEditMode && this.editingEntryId) {
      this.knowledgeBaseService.update(this.editingEntryId, formData).subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.success('Entry Updated', 'Knowledge base entry has been updated successfully.');
            this.cancelEdit();
            this.loadKnowledgeBase();
          } else {
            this.notificationService.error('Update Failed', 'Could not update the entry. Please try again.');
          }
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notificationService.error('Update Failed', 'Could not update the entry. Please try again.');
          this.submitting = false;
          this.cdr.markForCheck();
        }
      });
      return;
    }

    this.knowledgeBaseService.createManual(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Entry Added',
            'Your knowledge base entry is now active and will be used by the AI.'
          );
          this.manualForm.reset({ type: 'general', priority: 5, trainingWeight: 5, isTrainingData: true, isActive: true });
          this.manualTags = [];
          this.manualTagInput = '';
          this.resetManualContentFields();
          this.currentPage = 1;
          this.activeTab = 'list';
          this.loadKnowledgeBase();
        }
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: () => { this.submitting = false; this.cdr.markForCheck(); }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      if (!this.pdfForm.get('title')?.value) {
        this.pdfForm.patchValue({ title: file.name.replace('.pdf', '') });
      }
    } else {
      this.notificationService.warning('Invalid File', 'Please select a PDF file');
      event.target.value = '';
    }
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

    this.knowledgeBaseService.createFromPDF(formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success('PDF Uploaded', 'Content extracted and added to your knowledge base.');
          this.pdfForm.reset({ priority: 5 });
          this.pdfTags = [];
          this.pdfTagInput = '';
          this.selectedFile = null;
          this.currentPage = 1;
          this.activeTab = 'list';
          this.loadKnowledgeBase();
        }
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: () => { this.submitting = false; this.cdr.markForCheck(); }
    });
  }

  openCreditConfirmAndSubmit(): void {
    if (this.urlForm.invalid) return;
    this.pendingUrlFormData = { ...this.urlForm.value };
    this.showCreditConfirmModal = true;
  }

  closeCreditConfirmModal(): void {
    this.showCreditConfirmModal = false;
    this.pendingUrlFormData = null;
  }

  confirmCreateKnowledgeBase(): void {
    if (!this.pendingUrlFormData) return;
    this.showCreditConfirmModal = false;
    this.submitURLWithData(this.pendingUrlFormData);
    this.pendingUrlFormData = null;
  }

  submitURLWithData(formData: any): void {
    this.submitting = true;
    const payload = { ...formData, tags: [...this.urlTags] };

    this.knowledgeBaseService.createFromURL(payload).subscribe({
      next: (response) => {
        if (response.success) {
          this.urlForm.reset({ priority: 5, targetWordCount: 2000, targetTagCount: 10 });
          this.urlTags = [];
          this.urlTagInput = '';
          this.currentPage = 1;
          this.activeTab = 'list';
          this.notificationService.success('Knowledge Base', 'Entry created from URL successfully.');
          this.loadKnowledgeBase();
        }
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: () => { this.submitting = false; this.cdr.markForCheck(); }
    });
  }

  // ─── Entry actions ────────────────────────────────────────────────────────

  deleteEntry(id: string): void {
    this.sweetAlertService.confirmDelete(
      'Delete Knowledge Entry?',
      'This entry will be permanently removed and the AI will no longer use it.'
    ).then(result => {
      if (!result.isConfirmed) return;
      this.knowledgeBaseService.delete(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.notificationService.success('Deleted', 'Knowledge base entry removed.');
            if (this.filteredKnowledgeBase.length === 1 && this.currentPage > 1) {
              this.currentPage--;
            }
            this.loadKnowledgeBase();
          }
          this.cdr.markForCheck();
        }
      });
    });
  }

  toggleActive(entry: IKnowledgeBase): void {
    this.knowledgeBaseService.update(entry._id, { isActive: !entry.isActive }).subscribe({
      next: (response) => {
        if (response.success) {
          const wasActive = entry.isActive;
          entry.isActive = !entry.isActive;
          if (this.kbAnalytics) {
            if (wasActive) {
              this.kbAnalytics.activeCount = Math.max(0, this.kbAnalytics.activeCount - 1);
              this.kbAnalytics.inactiveCount++;
            } else {
              this.kbAnalytics.inactiveCount = Math.max(0, this.kbAnalytics.inactiveCount - 1);
              this.kbAnalytics.activeCount++;
            }
          }
          this.notificationService.success(
            entry.isActive ? 'Entry Activated' : 'Entry Deactivated',
            entry.isActive
              ? 'This entry is now used by the AI.'
              : 'This entry is excluded from AI responses.'
          );
          this.cdr.markForCheck();
        }
      }
    });
  }

  // ─── Display helpers ──────────────────────────────────────────────────────

  getSourceIcon(source: string): string {
    const icons: Record<string, string> = {
      manual: 'fa-keyboard', pdf: 'fa-file-pdf', url: 'fa-globe', import: 'fa-file-import'
    };
    return icons[source] || 'fa-question';
  }

  getSourceColor(source: string): string {
    const colors: Record<string, string> = {
      manual: 'bg-gray-100 text-gray-900 border border-gray-300 dark:bg-rep-lime/20 dark:text-rep-lime dark:border-rep-lime/30',
      pdf:    'bg-gray-100 text-gray-800 border border-gray-300',
      url:    'bg-gray-100 text-gray-900 border border-gray-300 dark:bg-rep-lime/20 dark:text-rep-lime dark:border-rep-lime/30',
      import: 'bg-gray-100 text-gray-800 border border-gray-300'
    };
    return colors[source] || 'bg-gray-100 text-gray-800 border border-gray-300';
  }

  lastUsedLabel(entry: IKnowledgeBase): string {
    if (!entry.usageCount || entry.usageCount === 0) return 'Never used';
    if (!entry.lastUsedAt) return `Used ${entry.usageCount}×`;
    const days = Math.floor((Date.now() - new Date(entry.lastUsedAt).getTime()) / 86_400_000);
    if (days === 0) return 'Used today';
    if (days === 1) return 'Used yesterday';
    return `Used ${days}d ago`;
  }

  usageBadgeClass(entry: IKnowledgeBase): string {
    if (!entry.usageCount || entry.usageCount === 0) {
      return 'bg-gray-200 text-gray-700 border border-gray-300';
    }
    const days = entry.lastUsedAt
      ? Math.floor((Date.now() - new Date(entry.lastUsedAt).getTime()) / 86_400_000)
      : 999;
    if (days <= 7)  return 'bg-gray-900 text-white border border-gray-700 dark:bg-rep-lime dark:text-gray-900 dark:border-rep-lime/50';
    if (days <= 30) return 'bg-amber-200 text-gray-900 border border-amber-300';
    return 'bg-gray-200 text-gray-700 border border-gray-300';
  }

  /** Recency pill only when there is real usage history and last use was not today (no “Never used” / “Used today” pills). */
  showUsageRecencyBadge(entry: IKnowledgeBase | null | undefined): boolean {
    if (!entry) return false;
    if (!entry.usageCount || entry.usageCount === 0) return false;
    if (!entry.lastUsedAt) return true;
    const days = Math.floor((Date.now() - new Date(entry.lastUsedAt).getTime()) / 86_400_000);
    return days !== 0;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }

  openReadModal(entry: IKnowledgeBase): void {
    this.readModalLoading = true;
    this.showReadModal = true;
    this.selectedEntry = null;
    this.cdr.markForCheck();
    this.knowledgeBaseService.getKnowledgeBase(entry._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.readModalLoading = false;
          this.selectedEntry = (res.success && res.data) ? res.data : entry;
          this.cdr.markForCheck();
        },
        error: () => {
          this.readModalLoading = false;
          this.selectedEntry = entry;
          this.cdr.markForCheck();
        }
      });
  }

  closeReadModal(): void {
    this.showReadModal = false;
    this.selectedEntry = null;
    this.readModalLoading = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(ev: Event): void {
    if (this.showReadModal) { ev.preventDefault(); this.closeReadModal(); }
    if (this.showAddMenu) { this.showAddMenu = false; this.cdr.markForCheck(); }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    if (!target.closest('[data-add-menu]')) {
      if (this.showAddMenu) { this.showAddMenu = false; this.cdr.markForCheck(); }
    }
  }
}
