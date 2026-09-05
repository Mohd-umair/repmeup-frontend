import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ContactService } from '../../../core/services/contact.service';
import { CampaignAudiencePrefillService } from '../../../core/services/campaign-audience-prefill.service';
import { FilterBuilderComponent } from '../../../shared/components/filter-builder/filter-builder.component';
import { PremiumSelectComponent, PremiumSelectOption } from '../../../shared/components/premium-select/premium-select.component';
import { ContactsPageHelpComponent } from '../shared/contacts-page-help.component';
import { SEGMENTS_HELP } from '../shared/contacts-help-content';
import { cloneExampleSegment } from '../shared/contacts-examples';
import { IContactFilterPreset, IFilterQuery } from '../../../core/models/contact.model';

@Component({
  selector: 'app-contact-segments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FilterBuilderComponent, PremiumSelectComponent, ContactsPageHelpComponent],
  templateUrl: './segments.component.html',
  styleUrl: './segments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SegmentsComponent implements OnInit {
  items: IContactFilterPreset[] = [];
  owners: { _id: string; firstName?: string; lastName?: string }[] = [];
  name = '';
  filterQuery: IFilterQuery = { logic: 'AND', conditions: [] };
  loading = false;
  creating = false;
  showCreatePanel = true;
  showHelp = false;
  counts: Record<string, number> = {};
  readonly help = SEGMENTS_HELP;
  tagInputBySegment: Record<string, string> = {};
  showTagFor: string | null = null;
  deleteConfirmId: string | null = null;

  readonly segmentActionOptions: PremiumSelectOption[] = [
    { value: 'campaign', label: 'Send campaign', iconClass: 'fas fa-bullhorn', colorClass: 'text-rep-lime' },
    { value: 'automation', label: 'Start automation', iconClass: 'fas fa-robot', colorClass: 'text-blue-500' },
    { value: 'tag', label: 'Add tag to members', iconClass: 'fas fa-tag', colorClass: 'text-amber-500' },
    { value: 'export', label: 'Export CSV', iconClass: 'fas fa-file-export', colorClass: 'text-gray-500' },
    { value: 'analyze', label: 'Refresh member count', iconClass: 'fas fa-chart-pie', colorClass: 'text-purple-500' },
    { value: 'delete', label: 'Delete segment', iconClass: 'fas fa-trash', colorClass: 'text-red-500' }
  ];

  constructor(
    private contacts: ContactService,
    private router: Router,
    private campaignPrefill: CampaignAudiencePrefillService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.applyExampleForm();
    this.load();
    this.contacts.owners().subscribe({
      next: (res) => { this.owners = res.data || []; this.cdr.markForCheck(); }
    });
  }

  load(): void {
    this.loading = true;
    this.contacts.listPresets('segment').subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  applyExampleForm(): void {
    const ex = cloneExampleSegment();
    this.name = ex.name;
    this.filterQuery = ex.filterQuery;
  }

  create(): void {
    if (!this.name.trim() || this.creating) return;
    if (!this.filterQuery.conditions?.length) return;
    this.creating = true;
    this.contacts.createPreset({ kind: 'segment', name: this.name.trim(), filterQuery: this.filterQuery }).subscribe({
      next: () => {
        this.applyExampleForm();
        this.creating = false;
        this.load();
        this.cdr.markForCheck();
      },
      error: () => {
        this.creating = false;
        this.cdr.markForCheck();
      }
    });
  }

  memberCount(seg: IContactFilterPreset): number {
    return this.counts[seg._id] ?? seg.memberCountCached ?? 0;
  }

  ruleCount(seg: IContactFilterPreset): number {
    return seg.filterQuery?.conditions?.length ?? 0;
  }

  onSegmentAction(seg: IContactFilterPreset, action: string): void {
    if (!action) return;
    switch (action) {
      case 'campaign':
        this.campaign(seg);
        break;
      case 'automation':
        this.automation();
        break;
      case 'tag':
        this.showTagFor = seg._id;
        this.tagInputBySegment[seg._id] = this.tagInputBySegment[seg._id] || '';
        break;
      case 'export':
        this.export(seg);
        break;
      case 'analyze':
        this.analyze(seg);
        break;
      case 'delete':
        this.deleteConfirmId = seg._id;
        break;
    }
    this.cdr.markForCheck();
  }

  applyTag(seg: IContactFilterPreset): void {
    const tag = (this.tagInputBySegment[seg._id] || '').trim();
    if (!tag) return;
    this.contacts.bulk({ action: 'add_tag', params: { tag }, filterQuery: seg.filterQuery }).subscribe({
      next: () => {
        this.showTagFor = null;
        this.tagInputBySegment[seg._id] = '';
        this.cdr.markForCheck();
      }
    });
  }

  cancelTag(): void {
    this.showTagFor = null;
    this.cdr.markForCheck();
  }

  campaign(seg: IContactFilterPreset): void {
    const count = this.counts[seg._id];
    this.campaignPrefill.set({
      filterQuery: seg.filterQuery,
      sourceLabel: count != null
        ? `Segment "${seg.name}" (${count.toLocaleString()} contacts)`
        : `Segment "${seg.name}"`
    });
    this.router.navigate(['/app/campaigns'], { queryParams: { create: '1' } });
  }

  onAssignOwner(seg: IContactFilterPreset, ownerId: string): void {
    if (!ownerId) return;
    this.contacts.bulk({ action: 'assign', params: { owner: ownerId }, filterQuery: seg.filterQuery }).subscribe({
      next: () => this.cdr.markForCheck()
    });
  }

  get ownerSelectOptions(): PremiumSelectOption[] {
    return this.owners.map((o) => ({
      value: o._id,
      label: [o.firstName, o.lastName].filter(Boolean).join(' ') || 'User'
    }));
  }

  export(seg: IContactFilterPreset): void {
    this.contacts.exportCsv({ filterQuery: seg.filterQuery }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${seg.name || 'segment'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  analyze(seg: IContactFilterPreset): void {
    this.contacts.filterPreview(seg.filterQuery).subscribe({
      next: (res) => {
        this.counts[seg._id] = res.data?.total || 0;
        this.cdr.markForCheck();
      }
    });
  }

  automation(): void {
    this.router.navigate(['/app/automation/flows']);
  }

  confirmDelete(seg: IContactFilterPreset): void {
    this.contacts.deletePreset(seg._id).subscribe({
      next: () => {
        this.deleteConfirmId = null;
        this.load();
      }
    });
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
    this.cdr.markForCheck();
  }

  openHelp(): void { this.showHelp = true; this.cdr.markForCheck(); }
  closeHelp(): void { this.showHelp = false; this.cdr.markForCheck(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeHelp(); }
}
