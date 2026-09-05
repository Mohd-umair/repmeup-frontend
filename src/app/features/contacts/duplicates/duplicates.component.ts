import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ContactService } from '../../../core/services/contact.service';
import { ContactsPageHelpComponent } from '../shared/contacts-page-help.component';
import { DUPLICATES_HELP } from '../shared/contacts-help-content';

@Component({
  selector: 'app-contact-duplicates',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ContactsPageHelpComponent],
  templateUrl: './duplicates.component.html',
  styleUrl: './duplicates.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DuplicatesComponent implements OnInit {
  items: any[] = [];
  loading = false;
  scanning = false;
  error: string | null = null;
  showHelp = false;
  resolutions: Record<string, Record<string, 'primary' | 'secondary'>> = {};

  readonly help = DUPLICATES_HELP;

  /** Example pair shown when the queue is empty — helps users understand the review UI. */
  readonly examplePair = {
    matchScore: 85,
    matchedOn: ['phone'],
    contactA: { primaryName: 'Ali Hassan', primaryPhone: '+971 50 123 4567', primaryEmail: 'ali@example.com' },
    contactB: { primaryName: 'Ali H.', primaryPhone: '+971501234567', primaryEmail: '—' }
  };

  constructor(private contacts: ContactService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.contacts.duplicates().subscribe({
      next: (res) => { this.items = res.data || []; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.error = 'Could not load duplicates.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  scan(): void {
    this.scanning = true;
    this.contacts.scanDuplicates().subscribe({
      next: () => {
        this.scanning = false;
        setTimeout(() => this.load(), 3000);
        this.cdr.markForCheck();
      },
      error: () => { this.scanning = false; this.cdr.markForCheck(); }
    });
  }

  dismiss(row: any): void {
    this.contacts.dismissDuplicate(row._id).subscribe({ next: () => this.load() });
  }

  resolution(row: any, field: string): 'primary' | 'secondary' {
    return this.resolutions[row._id]?.[field] || 'primary';
  }

  setResolution(row: any, field: string, value: 'primary' | 'secondary'): void {
    this.resolutions = {
      ...this.resolutions,
      [row._id]: { ...(this.resolutions[row._id] || {}), [field]: value }
    };
  }

  merge(row: any, keep: 'A' | 'B'): void {
    const primary = keep === 'A' ? row.contactA : row.contactB;
    const secondary = keep === 'A' ? row.contactB : row.contactA;
    if (!primary?._id || !secondary?._id) return;
    const selected = this.resolutions[row._id] || {};
    const fieldResolutions = Object.fromEntries(
      Object.entries(selected).map(([field, side]) => [
        field,
        (keep === 'A' ? side : side === 'primary' ? 'secondary' : 'primary')
      ])
    ) as Record<string, 'primary' | 'secondary'>;
    this.contacts.mergeContact(primary._id, { secondaryId: secondary._id, fieldResolutions }).subscribe({
      next: () => this.load()
    });
  }

  openHelp(): void { this.showHelp = true; this.cdr.markForCheck(); }
  closeHelp(): void { this.showHelp = false; this.cdr.markForCheck(); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.closeHelp(); }
}
