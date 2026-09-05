import {
  Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { ContactService } from '../../../core/services/contact.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CampaignAudiencePrefillService, CampaignAudiencePrefill } from '../../../core/services/campaign-audience-prefill.service';
import { InboxAvatarService } from '../../../core/services/inbox-avatar.service';
import { IContact, IContactFilterPreset, IFilterQuery } from '../../../core/models/contact.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { FilterBuilderComponent } from '../../../shared/components/filter-builder/filter-builder.component';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';
import { ContactImportMapComponent } from '../shared/contact-import-map.component';
import { ContactImportFieldMapping } from '../shared/contact-csv.util';
import { isComingSoonPlatform, COMING_SOON_PLATFORM_LABEL } from '../../../core/constants/platform-availability.constants';
import { getContactAiStatusLabel } from '../../../core/utils/contact-ai-display.util';

const PLATFORMS = ['instagram', 'facebook', 'whatsapp', 'youtube', 'google', 'linkedin', 'shopify'];

interface IFilterHelpSection {
  title: string;
  icon: string;
  summary: string;
  examples: string[];
}

interface IFilterHelpExample {
  title: string;
  steps: string[];
}

@Component({
  selector: 'app-contacts-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaginationComponent, FilterBuilderComponent, PremiumSelectComponent, ContactImportMapComponent],
  templateUrl: './contacts-list.component.html',
  styleUrl: './contacts-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactsListComponent implements OnInit, OnDestroy {
  @Output() contactSelected = new EventEmitter<IContact>();
  @ViewChild('csvImportInput') csvImportInput?: ElementRef<HTMLInputElement>;

  contacts: IContact[] = [];
  loading = false;
  error: string | null = null;
  searchQuery = '';
  selectedPlatform = '';
  selectedTag = '';
  currentPage = 1;
  totalPages = 1;
  totalContacts = 0;
  pageSize = 20;
  readonly platforms = PLATFORMS;
  readonly comingSoonLabel = COMING_SOON_PLATFORM_LABEL;
  avatarErrors: Record<string, boolean> = {};
  showFiltersPanel = false;
  showFilterHelp = false;
  showToolsMenu = false;
  showSaveViewForm = false;
  filterQuery: IFilterQuery = { logic: 'AND', conditions: [] };
  views: IContactFilterPreset[] = [];
  tags: { tag: string; count: number }[] = [];
  selected = new Set<string>();
  bulkTag = '';
  bulkOwner = '';
  bulkSegmentId = '';
  segments: IContactFilterPreset[] = [];
  owners: { _id: string; firstName?: string; lastName?: string }[] = [];
  saveViewName = '';
  importing = false;
  showImportMap = false;
  pendingCsvText = '';
  pendingFileName = '';
  readonly importMaxRows = 20000;
  readonly importMaxBytes = 10 * 1024 * 1024;

  sortField = 'lastInteractionAt';
  sortDir: 'asc' | 'desc' = 'desc';

  /** Columns that support server-side sort (must match backend SORT_FIELDS). */
  readonly sortableFields = new Set([
    'primaryName',
    'lifecycleStage',
    'leadScore',
    'engagementScore',
    'lastInteractionAt'
  ]);

  readonly filterHelpSections: IFilterHelpSection[] = [
    {
      title: 'Search',
      icon: 'fa-search',
      summary: 'Free-text lookup across name, phone, email, company, tags, and channel usernames. Waits 350ms after you stop typing.',
      examples: [
        'Search "ali" → matches Ali Hassan, alison@email.com, or tag "vip-ali"',
        'Search "97150" → matches phone numbers containing those digits'
      ]
    },
    {
      title: 'Platform',
      icon: 'fa-share-nodes',
      summary: 'Shows contacts who have at least one channel on the selected platform (WhatsApp, Instagram, etc.).',
      examples: [
        'Platform = WhatsApp → only contacts with a WhatsApp channel',
        'Combine with search: "sara" + WhatsApp → Sara on WhatsApp only'
      ]
    },
    {
      title: 'Tag',
      icon: 'fa-tag',
      summary: 'Filters contacts that have a specific tag in their profile.',
      examples: [
        'Tag = vip → contacts tagged "vip"',
        'Tag = newsletter + Platform = Instagram → VIPs on Instagram'
      ]
    },
    {
      title: 'Advanced rules',
      icon: 'fa-sliders-h',
      summary: 'Build CRM rules with AND/OR logic. Each rule is field + operator + value. Processed on the server.',
      examples: [
        'Lifecycle is lead → new prospects only',
        'Lead score ≥ 70 → hot leads',
        'Last activity is last 7 days → recently active',
        'Sentiment is negative → needs attention',
        'Campaign activity: replied to [Campaign X] → engaged recipients'
      ]
    },
    {
      title: 'Saved views',
      icon: 'fa-bookmark',
      summary: 'One-click presets (e.g. My Leads, VIP Customers). Loads advanced rules instantly. Save your own with "Save current filters as view".',
      examples: [
        'Click "My Leads" → lifecycle = lead',
        'Click "Unassigned" → contacts with no owner'
      ]
    }
  ];

  readonly filterHelpScenarios: IFilterHelpExample[] = [
    {
      title: 'WhatsApp customers who spent over ₹10,000',
      steps: ['Platform → WhatsApp', 'Add rule: Lifetime value > 10000', 'Logic: AND (match all)']
    },
    {
      title: 'At-risk leads with negative sentiment',
      steps: ['Add rule: Lifecycle is at_risk', 'Add rule: Sentiment is negative', 'Logic: AND']
    },
    {
      title: 'Campaign follow-up list',
      steps: ['Add rule: Campaign activity → was sent → pick your campaign', 'Add rule: Campaign activity → did not reply', 'Export CSV or create campaign']
    }
  ];

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private contactService: ContactService,
    private notificationService: NotificationService,
    private avatarService: InboxAvatarService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private campaignPrefill: CampaignAudiencePrefillService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchSubject.pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => {
      this.currentPage = 1;
      this.loadContacts();
    });
    this.loadContacts();
    this.contactService.listPresets('saved_view').pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.views = res.data || [];
        if (!this.views.length) {
          this.contactService.seedViews().pipe(takeUntil(this.destroy$)).subscribe({
            next: () => this.contactService.listPresets('saved_view').subscribe({
              next: (seeded) => { this.views = seeded.data || []; this.cdr.markForCheck(); }
            })
          });
        }
        this.cdr.markForCheck();
      }
    });
    this.contactService.listTags().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.tags = res.data || []; this.cdr.markForCheck(); }
    });
    this.contactService.owners().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.owners = res.data || []; this.cdr.markForCheck(); }
    });
    this.contactService.listPresets('segment').pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.segments = res.data || []; this.cdr.markForCheck(); }
    });
  }

  exportCsv(): void {
    this.contactService.exportCsv({
      search: this.searchQuery || undefined,
      platform: this.selectedPlatform || undefined,
      tag: this.selectedTag || undefined,
      filterQuery: this.filterQuery.conditions.length ? this.filterQuery : undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadContacts(): void {
    this.loading = true;
    this.error = null;
    this.contactService.getContacts({
      search: this.searchQuery || undefined,
      platform: this.selectedPlatform || undefined,
      tag: this.selectedTag || undefined,
      filterQuery: this.filterQuery.conditions.length ? this.filterQuery : undefined,
      page: this.currentPage,
      limit: this.pageSize,
      sortField: this.sortField,
      sortDir: this.sortDir
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.contacts = res.data || [];
        this.totalContacts = res.pagination?.total ?? 0;
        this.totalPages = res.pagination?.pages ?? 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load contacts.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void { this.searchSubject.next(this.searchQuery); }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedPlatform || this.selectedTag || this.filterQuery.conditions.length);
  }

  activeFilterCount(): number {
    let count = this.filterQuery.conditions.length;
    if (this.searchQuery) count += 1;
    if (this.selectedPlatform) count += 1;
    if (this.selectedTag) count += 1;
    return count;
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.selectedPlatform = '';
    this.selectedTag = '';
    this.filterQuery = { logic: 'AND', conditions: [] };
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  toggleFiltersPanel(): void {
    this.showFiltersPanel = !this.showFiltersPanel;
    this.cdr.markForCheck();
  }

  openFilterHelp(event: Event): void {
    event.stopPropagation();
    this.showFilterHelp = true;
    this.showToolsMenu = false;
    this.cdr.markForCheck();
  }

  closeFilterHelp(): void {
    if (!this.showFilterHelp) return;
    this.showFilterHelp = false;
    this.cdr.markForCheck();
  }

  toggleToolsMenu(event: Event): void {
    event.stopPropagation();
    this.showToolsMenu = !this.showToolsMenu;
    this.cdr.markForCheck();
  }

  closeMenus(): void {
    if (!this.showToolsMenu) return;
    this.showToolsMenu = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeFilterHelp();
    this.closeMenus();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenus();
  }

  clearSelection(): void {
    this.selected.clear();
    this.selected = new Set(this.selected);
    this.cdr.markForCheck();
  }

  selectAllOnPage(): void {
    this.contacts.forEach((c) => this.selected.add(c._id));
    this.selected = new Set(this.selected);
    this.cdr.markForCheck();
  }

  clearPlatformFilter(): void {
    this.onPlatformSelect('');
  }

  clearTagFilter(): void {
    this.onTagSelect('');
  }

  onPlatformSelect(value: string): void {
    if (value && isComingSoonPlatform(value)) return;
    this.selectedPlatform = value;
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  onTagSelect(value: string): void {
    this.selectedTag = value;
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  onBulkOwnerSelect(ownerId: string): void {
    this.bulkOwner = ownerId;
    if (!ownerId) return;
    this.bulk('assign', { owner: ownerId });
    this.bulkOwner = '';
  }

  onBulkSegmentSelect(segmentId: string): void {
    this.bulkSegmentId = segmentId;
    if (!segmentId) return;
    this.bulk('add_to_segment', { segmentId });
    this.bulkSegmentId = '';
  }

  get platformFilterOptions(): PremiumSelectOption[] {
    return [
      { value: '', label: 'Any platform' },
      ...this.platforms.map((p) => ({
        value: p,
        label: p.charAt(0).toUpperCase() + p.slice(1),
        iconClass: `fab ${this.getPlatformIcon(p)}`,
        colorClass: this.getPlatformColor(p),
        disabled: this.isPlatformComingSoon(p),
        ...(this.isPlatformComingSoon(p) ? { disabledHint: 'Soon' as const } : {})
      }))
    ];
  }

  get tagFilterOptions(): PremiumSelectOption[] {
    return [
      { value: '', label: 'Any tag' },
      ...this.tags.slice(0, 40).map((t) => ({
        value: t.tag,
        label: `${t.tag} (${t.count})`
      }))
    ];
  }

  get ownerSelectOptions(): PremiumSelectOption[] {
    return this.owners.map((o) => ({
      value: o._id,
      label: [o.firstName, o.lastName].filter(Boolean).join(' ') || 'User'
    }));
  }

  get segmentSelectOptions(): PremiumSelectOption[] {
    return this.segments.map((s) => ({ value: s._id, label: s.name }));
  }

  clearAdvancedFilters(): void {
    this.filterQuery = { logic: 'AND', conditions: [] };
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  onFiltersChange(q: IFilterQuery): void {
    this.filterQuery = q;
    this.currentPage = 1;
    this.loadContacts();
  }
  applyView(view: IContactFilterPreset): void {
    this.filterQuery = view.filterQuery || { logic: 'AND', conditions: [] };
    if (this.filterQuery.conditions.length) {
      this.showFiltersPanel = true;
    }
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }
  saveView(): void {
    if (!this.saveViewName.trim()) return;
    this.contactService.createPreset({
      kind: 'saved_view',
      name: this.saveViewName.trim(),
      filterQuery: this.filterQuery
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.data) this.views = [...this.views, res.data];
        this.saveViewName = '';
        this.showSaveViewForm = false;
        this.cdr.markForCheck();
      }
    });
  }
  onPageChange(page: number): void { this.currentPage = page; this.loadContacts(); }
  onPageSizeChange(size: number): void { this.pageSize = size; this.currentPage = 1; this.loadContacts(); }

  toggleSort(field: string): void {
    if (!this.sortableFields.has(field)) return;
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = field === 'primaryName' ? 'asc' : 'desc';
    }
    this.currentPage = 1;
    this.loadContacts();
    this.cdr.markForCheck();
  }

  sortAriaSort(field: string): 'ascending' | 'descending' | 'none' {
    if (this.sortField !== field) return 'none';
    return this.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  sortIconClass(field: string): string {
    if (this.sortField !== field) return 'fa-sort text-gray-300 dark:text-gray-600';
    return this.sortDir === 'asc' ? 'fa-sort-up text-rep-lime' : 'fa-sort-down text-rep-lime';
  }

  selectContact(contact: IContact): void { this.contactSelected.emit(contact); }

  toggleSelect(id: string, ev: Event): void {
    ev.stopPropagation();
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.selected = new Set(this.selected);
    this.cdr.markForCheck();
  }
  toggleAll(): void {
    if (this.selected.size === this.contacts.length) this.selected.clear();
    else this.contacts.forEach((c) => this.selected.add(c._id));
    this.selected = new Set(this.selected);
    this.cdr.markForCheck();
  }
  bulk(action: string, params: Record<string, unknown> = {}): void {
    this.contactService.bulk({
      action,
      params,
      contactIds: this.selected.size ? [...this.selected] : undefined,
      filterQuery: !this.selected.size && this.filterQuery.conditions.length ? this.filterQuery : undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadContacts();
        this.cdr.markForCheck();
      }
    });
  }
  createCampaign(): void {
    const prefill: CampaignAudiencePrefill = {};

    if (this.selected.size > 0) {
      prefill.contactIds = [...this.selected];
      prefill.sourceLabel = `${this.selected.size} selected contact${this.selected.size === 1 ? '' : 's'}`;
    } else if (
      this.filterQuery.conditions.length ||
      this.searchQuery.trim() ||
      this.selectedPlatform ||
      this.selectedTag
    ) {
      if (this.filterQuery.conditions.length) prefill.filterQuery = this.filterQuery;
      if (this.searchQuery.trim()) prefill.search = this.searchQuery.trim();
      if (this.selectedPlatform) prefill.platform = this.selectedPlatform;
      if (this.selectedTag) prefill.tag = this.selectedTag;
      prefill.sourceLabel = `Current list (${this.totalContacts.toLocaleString()} contact${this.totalContacts === 1 ? '' : 's'})`;
    }

    if (prefill.contactIds?.length || prefill.filterQuery || prefill.search || prefill.platform || prefill.tag) {
      this.campaignPrefill.set(prefill);
    }

    this.router.navigate(['/app/campaigns'], { queryParams: { create: '1' } });
  }

  triggerCsvImport(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeMenus();
    this.csvImportInput?.nativeElement.click();
  }

  onImport(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > this.importMaxBytes) {
      this.notificationService.error('File too large', 'CSV must be 10 MB or smaller.');
      this.cdr.markForCheck();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) {
        this.notificationService.warning('Empty file', 'The CSV file has no content.');
        this.cdr.markForCheck();
        return;
      }
      this.pendingCsvText = text;
      this.pendingFileName = file.name;
      this.showImportMap = true;
      this.cdr.markForCheck();
    };
    reader.onerror = () => {
      this.notificationService.error('Import failed', 'Could not read the CSV file.');
      this.cdr.markForCheck();
    };
    reader.readAsText(file);
  }

  closeImportMap(): void {
    if (this.importing) return;
    this.showImportMap = false;
    this.pendingCsvText = '';
    this.pendingFileName = '';
    this.cdr.markForCheck();
  }

  confirmImport(mapping: ContactImportFieldMapping): void {
    if (this.importing || !this.pendingCsvText) return;
    this.importing = true;
    this.cdr.markForCheck();

    const payload = {
      name: mapping.name || undefined,
      phone: mapping.phone || undefined,
      email: mapping.email || undefined
    };

    this.contactService.importCsv(this.pendingCsvText, payload)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.importing = false;
          this.showImportMap = false;
          this.pendingCsvText = '';
          this.pendingFileName = '';
          const data = res.data;
          const imported = data?.imported ?? 0;
          const updated = data?.updated ?? 0;
          const failed = data?.failed ?? 0;
          this.loadContacts();
          if (imported + updated === 0 && failed > 0) {
            this.notificationService.error(
              'Import failed',
              `${failed} row${failed === 1 ? '' : 's'} had no phone or email in the mapped columns.`,
              8000
            );
          } else if (failed > 0) {
            this.notificationService.warning(
              'Import completed with issues',
              `${imported} created, ${updated} updated, ${failed} skipped.`
            );
          } else {
            this.notificationService.success(
              'Import complete',
              `${imported} created, ${updated} updated.`
            );
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.importing = false;
          const msg = err?.error?.error || err?.error?.message || 'Could not import contacts. Check your mapping and permissions.';
          this.notificationService.error('Import failed', msg);
          this.cdr.markForCheck();
        }
      });
  }

  isPlatformComingSoon(p: string): boolean { return isComingSoonPlatform(p); }
  platformFilterTitle(p: string): string { return this.isPlatformComingSoon(p) ? `${p} — ${this.comingSoonLabel}` : p; }
  getPlatformIcon(p: string): string {
    const icons: Record<string, string> = { instagram: 'fa-instagram', facebook: 'fa-facebook', whatsapp: 'fa-whatsapp', youtube: 'fa-youtube', google: 'fa-google', linkedin: 'fa-linkedin', twitter: 'fa-twitter', shopify: 'fa-shopify' };
    return icons[p] || 'fa-globe';
  }
  getPlatformColor(p: string): string {
    const colors: Record<string, string> = { instagram: 'text-pink-500', facebook: 'text-blue-600', whatsapp: 'text-green-500', youtube: 'text-red-500', google: 'text-yellow-500', linkedin: 'text-blue-700', twitter: 'text-sky-500', shopify: 'text-[#95BF47]' };
    return colors[p] || 'text-gray-500';
  }
  getContactAvatarUrl$(contact: IContact): Observable<SafeUrl | null> {
    return this.avatarService.getContactAvatarUrl$(contact).pipe(map((url) => (url ? this.sanitizer.bypassSecurityTrustUrl(url) : null)));
  }
  onContactAvatarError(id: string): void { this.avatarErrors = { ...this.avatarErrors, [id]: true }; this.cdr.markForCheck(); }
  getInitials(name: string): string {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }
  ownerName(contact: IContact): string {
    const o = contact.owner;
    if (!o || typeof o === 'string') return '—';
    return [o.firstName, o.lastName].filter(Boolean).join(' ') || '—';
  }
  lastActivity(contact: IContact): string {
    if (!contact.lastInteractionAt) return '—';
    const ms = Date.now() - new Date(contact.lastInteractionAt).getTime();
    const h = Math.floor(ms / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }
  aiStatus(contact: IContact): string {
    return getContactAiStatusLabel(contact);
  }
}
