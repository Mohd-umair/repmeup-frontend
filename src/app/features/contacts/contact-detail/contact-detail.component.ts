import {
  Component, Input, OnChanges, OnDestroy, SimpleChanges, Output, EventEmitter,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ContactService } from '../../../core/services/contact.service';
import { NotificationService } from '../../../core/services/notification.service';
import { InboxAvatarService } from '../../../core/services/inbox-avatar.service';
import { IContact } from '../../../core/models/contact.model';
import { formatAiIntentLabel } from '../../../core/utils/contact-ai-display.util';

@Component({
  selector: 'app-contact-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './contact-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactDetailComponent implements OnChanges, OnDestroy {
  @Input() contactId: string | null = null;
  @Output() back = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();

  contact: IContact | null = null;
  loading = false;
  saving = false;
  error: string | null = null;

  editing = false;
  draftName = '';
  draftPhone = '';
  draftEmail = '';
  draftNotes = '';
  draftTagInput = '';
  draftTags: string[] = [];

  mergePhone = '';
  mergeEmail = '';
  showMergeDialog = false;
  merging = false;
  contactAvatarError = false;

  private destroy$ = new Subject<void>();

  constructor(
    private contactService: ContactService,
    private notify: NotificationService,
    private avatarService: InboxAvatarService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contactId'] && this.contactId) {
      this.contactAvatarError = false;
      this.loadContact();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadContact(): void {
    if (!this.contactId) return;
    this.loading = true;
    this.error = null;
    this.editing = false;

    this.contactService.getContact(this.contactId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.contact = res.data ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to load contact.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startEditing(): void {
    if (!this.contact) return;
    this.draftName = this.contact.primaryName;
    this.draftPhone = this.contact.primaryPhone || '';
    this.draftEmail = this.contact.primaryEmail || '';
    this.draftNotes = this.contact.notes || '';
    this.draftTags = [...(this.contact.tags || [])];
    this.draftTagInput = '';
    this.editing = true;
  }

  cancelEditing(): void {
    this.editing = false;
  }

  addTag(): void {
    const t = this.draftTagInput.trim().toLowerCase();
    if (t && !this.draftTags.includes(t)) {
      this.draftTags.push(t);
    }
    this.draftTagInput = '';
  }

  removeTag(tag: string): void {
    this.draftTags = this.draftTags.filter(t => t !== tag);
  }

  onTagKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  saveContact(): void {
    if (!this.contact || this.saving) return;
    this.saving = true;

    this.contactService.updateContact(this.contact._id, {
      primaryName: this.draftName.trim() || this.contact.primaryName,
      primaryPhone: this.draftPhone.trim() || null,
      primaryEmail: this.draftEmail.trim() || null,
      notes: this.draftNotes.trim() || null,
      tags: this.draftTags
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.contact = res.data ?? null;
        this.editing = false;
        this.saving = false;
        this.notify.success('Saved', 'Contact updated successfully.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error('Error', err?.error?.error || 'Could not save contact.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteContact(): void {
    if (!this.contact) return;
    if (!confirm(`Delete contact "${this.contact.primaryName}"? This cannot be undone.`)) return;

    this.contactService.deleteContact(this.contact._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notify.success('Deleted', 'Contact deleted.');
        this.deleted.emit();
      },
      error: (err) => {
        this.notify.error('Error', err?.error?.error || 'Could not delete contact.');
      }
    });
  }

  openMergeDialog(): void {
    this.mergePhone = '';
    this.mergeEmail = '';
    this.showMergeDialog = true;
  }

  closeMergeDialog(): void {
    this.showMergeDialog = false;
    this.mergePhone = '';
    this.mergeEmail = '';
  }

  confirmMerge(): void {
    if (!this.contact) return;
    const phone = this.mergePhone.trim();
    const email = this.mergeEmail.trim();
    if (!phone && !email) return;

    this.merging = true;
    const lookup = phone ? { phone } : { email };

    this.contactService.mergeContact(this.contact._id, lookup)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.contact = res.data ?? null;
          this.merging = false;
          this.showMergeDialog = false;
          this.notify.success('Merged', 'Contacts merged successfully.');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.merging = false;
          this.notify.error('Error', err?.error?.error || 'Merge failed.');
          this.cdr.markForCheck();
        }
      });
  }

  getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      instagram: 'fa-instagram', facebook: 'fa-facebook',
      whatsapp: 'fa-whatsapp', youtube: 'fa-youtube',
      google: 'fa-google', linkedin: 'fa-linkedin', twitter: 'fa-twitter',
      shopify: 'fa-shopify'
    };
    return icons[platform] || 'fa-globe';
  }

  getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      instagram: 'text-pink-500', facebook: 'text-blue-600',
      whatsapp: 'text-green-500', youtube: 'text-red-500',
      google: 'text-yellow-500', linkedin: 'text-blue-700', twitter: 'text-sky-500',
      shopify: 'text-[#95BF47]'
    };
    return colors[platform] || 'text-gray-500';
  }

  getInitials(name: string): string {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  contactAvatarUrl$(): Observable<SafeUrl | null> {
    return this.avatarService.getContactAvatarUrl$(this.contact).pipe(
      map(url => (url ? this.sanitizer.bypassSecurityTrustUrl(url) : null))
    );
  }

  onContactAvatarError(): void {
    this.contactAvatarError = true;
    this.cdr.markForCheck();
  }

  get displayIntent(): string | null {
    return formatAiIntentLabel(this.contact?.aiInsights?.intent);
  }

  getSentimentBadge(sentiment: string | null | undefined): { label: string; cls: string } {
    if (!sentiment) return { label: '', cls: '' };
    const s = sentiment.toLowerCase();
    if (s === 'positive') return { label: 'Positive', cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' };
    if (s === 'negative') return { label: 'Negative', cls: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' };
    return { label: 'Neutral', cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' };
  }

  getPriorityBadge(priority: string | null | undefined): { label: string; cls: string } {
    if (!priority) return { label: '', cls: '' };
    const p = priority.toLowerCase();
    if (p === 'high' || p === 'urgent') return { label: priority, cls: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' };
    if (p === 'medium') return { label: priority, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' };
    return { label: priority, cls: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800' };
  }

  getPlatformStatusClass(status: string): string {
    if (status === 'replied' || status === 'resolved') return 'text-green-500';
    if (status === 'unread') return 'text-blue-500';
    return 'text-amber-500';
  }
}
