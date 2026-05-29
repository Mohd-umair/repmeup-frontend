import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WhatsAppTemplateService } from '../../../core/services/whatsapp-template.service';
import {
  TemplateCategory,
  WhatsAppTemplate
} from '../../../core/models/whatsapp-template.model';
import {
  WhatsAppTemplateStarter,
  WHATSAPP_TEMPLATE_STARTERS,
  filterStarters,
  starterBodyPreview
} from '../../../core/data/whatsapp-template-starters';

export type TemplatePickerTab = 'approved' | 'starters';

@Component({
  selector: 'app-whatsapp-template-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp-template-picker.component.html',
  styleUrl: './whatsapp-template-picker.component.scss'
})
export class WhatsAppTemplatePickerComponent implements OnChanges, OnDestroy {
  private readonly templateService = inject(WhatsAppTemplateService);
  private readonly destroy$ = new Subject<void>();

  /** WhatsApp PlatformConnection _id — required to load Meta-approved templates. */
  @Input() connectionId = '';
  /** Show Meta-approved tab, starter library tab, or both. */
  @Input() mode: 'approved' | 'starters' | 'both' = 'both';
  /** Highlight currently selected approved template by name. */
  @Input() selectedTemplateName = '';
  /** Only list APPROVED templates from Meta (default true). */
  @Input() approvedOnly = true;
  @Input() compact = false;
  /** Show connection dropdown in toolbar (same as My templates page). */
  @Input() showConnectionSelector = false;
  @Input() connections: Array<{
    _id: string;
    platformData?: { displayPhoneNumber?: string };
    platformUsername?: string;
  }> = [];

  @Output() templateSelected = new EventEmitter<WhatsAppTemplate>();
  @Output() starterSelected = new EventEmitter<WhatsAppTemplateStarter>();
  @Output() connectionChange = new EventEmitter<string>();

  activeTab: TemplatePickerTab = 'approved';
  searchQuery = '';
  filterCategory: TemplateCategory | '' = '';

  approvedTemplates: WhatsAppTemplate[] = [];
  filteredApproved: WhatsAppTemplate[] = [];
  filteredStarters: WhatsAppTemplateStarter[] = [...WHATSAPP_TEMPLATE_STARTERS];

  loadingApproved = false;
  approvedError = '';
  dataSource: 'meta' | 'db_fallback' | null = null;

  readonly categories: { value: TemplateCategory | ''; label: string }[] = [
    { value: '', label: 'All Categories' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'UTILITY', label: 'Utility' },
    { value: 'AUTHENTICATION', label: 'Authentication' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['connectionId'] || changes['mode']) {
      this.initTab();
      if (this.showApprovedTab && this.connectionId) {
        this.loadApproved();
      }
    }
    if (changes['mode']) {
      this.applyFilters();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get showApprovedTab(): boolean {
    return this.mode === 'approved' || this.mode === 'both';
  }

  get showStartersTab(): boolean {
    return this.mode === 'starters' || this.mode === 'both';
  }

  private initTab(): void {
    if (this.mode === 'starters') {
      this.activeTab = 'starters';
    } else {
      this.activeTab = 'approved';
    }
  }

  setTab(tab: TemplatePickerTab): void {
    this.activeTab = tab;
    if (tab === 'approved' && this.connectionId && !this.approvedTemplates.length && !this.loadingApproved) {
      this.loadApproved();
    }
  }

  loadApproved(): void {
    if (!this.connectionId) {
      this.approvedTemplates = [];
      this.filteredApproved = [];
      this.approvedError = 'Select a WhatsApp connection first.';
      return;
    }

    this.loadingApproved = true;
    this.approvedError = '';
    this.templateService
      .listTemplates(this.connectionId, this.filterCategory || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          let list = res.templates || [];
          if (this.approvedOnly) {
            list = list.filter(t => String(t.status || '').toUpperCase() === 'APPROVED');
          }
          this.approvedTemplates = list;
          this.dataSource = res.source;
          this.applyFilters();
          this.loadingApproved = false;
        },
        error: (err) => {
          this.approvedTemplates = [];
          this.filteredApproved = [];
          this.approvedError = err?.error?.error || 'Could not load templates from Meta.';
          this.loadingApproved = false;
        }
      });
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onCategoryChange(): void {
    if (this.activeTab === 'approved' && this.connectionId) {
      this.loadApproved();
    } else {
      this.applyFilters();
    }
  }

  onConnectionSelect(connectionId: string): void {
    this.connectionChange.emit(connectionId);
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredStarters = filterStarters(this.searchQuery, this.filterCategory);

    let approved = [...this.approvedTemplates];
    if (this.filterCategory) {
      approved = approved.filter(t => t.category === this.filterCategory);
    }
    if (q) {
      approved = approved.filter(t => {
        const body = this.bodyText(t).toLowerCase();
        return t.name.toLowerCase().includes(q) || body.includes(q);
      });
    }
    this.filteredApproved = approved;
  }

  pickApproved(t: WhatsAppTemplate): void {
    this.selectedTemplateName = t.name;
    this.templateSelected.emit(t);
  }

  pickStarter(s: WhatsAppTemplateStarter): void {
    this.starterSelected.emit(s);
  }

  bodyText(t: WhatsAppTemplate): string {
    return t.components?.find(c => c.type === 'BODY')?.text || '';
  }

  starterPreview(s: WhatsAppTemplateStarter): string {
    return starterBodyPreview(s);
  }

  categoryClass(cat: TemplateCategory | string): string {
    const map: Record<string, string> = {
      MARKETING: 'cat-marketing',
      UTILITY: 'cat-utility',
      AUTHENTICATION: 'cat-auth'
    };
    return map[cat] || '';
  }

  categoryIcon(cat: TemplateCategory | string): string {
    const map: Record<string, string> = {
      MARKETING: 'fa-bullhorn',
      UTILITY: 'fa-tools',
      AUTHENTICATION: 'fa-shield-alt'
    };
    return map[cat] || 'fa-file-alt';
  }

  isSelectedApproved(t: WhatsAppTemplate): boolean {
    return !!this.selectedTemplateName && t.name === this.selectedTemplateName;
  }

  trackApproved(_: number, t: WhatsAppTemplate): string {
    return (t._id || t.id || t.metaTemplateId || t.name) as string;
  }

  trackStarter(_: number, s: WhatsAppTemplateStarter): string {
    return s.id;
  }
}
