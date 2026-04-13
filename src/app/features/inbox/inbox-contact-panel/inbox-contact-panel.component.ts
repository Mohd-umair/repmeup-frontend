import {
  Component, Input, OnChanges, OnDestroy, SimpleChanges,
  ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ContactService } from '../../../core/services/contact.service';
import { IInteraction } from '../../../core/models/interaction.model';
import { IContact } from '../../../core/models/contact.model';

@Component({
  selector: 'app-inbox-contact-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inbox-contact-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxContactPanelComponent implements OnChanges, OnDestroy {
  @Input() interaction: IInteraction | null = null;

  contact: IContact | null = null;
  loading = false;
  error: string | null = null;

  private loadedContactId: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private contactService: ContactService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['interaction']) {
      const contactId = this.interaction?.contact as string | null | undefined;
      if (contactId && contactId !== this.loadedContactId) {
        this.loadContact(contactId);
      } else if (!contactId) {
        this.contact = null;
        this.loadedContactId = null;
        this.error = null;
        this.cdr.markForCheck();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadContact(id: string): void {
    this.loading = true;
    this.error = null;
    this.contact = null;
    this.loadedContactId = id;

    this.contactService.getContact(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.contact = res.data ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.error || 'Could not load contact.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      instagram: 'fa-instagram', facebook: 'fa-facebook',
      whatsapp: 'fa-whatsapp', youtube: 'fa-youtube',
      google: 'fa-google', linkedin: 'fa-linkedin', twitter: 'fa-twitter'
    };
    return icons[platform] || 'fa-globe';
  }

  getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      instagram: 'text-pink-500', facebook: 'text-blue-600',
      whatsapp: 'text-green-500', youtube: 'text-red-500',
      google: 'text-yellow-500', linkedin: 'text-blue-700', twitter: 'text-sky-500'
    };
    return colors[platform] || 'text-gray-500';
  }

  getInitials(name: string): string {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  getSentimentBadge(sentiment: string | null | undefined): { label: string; cls: string } {
    if (!sentiment) return { label: '', cls: '' };
    const s = sentiment.toLowerCase();
    if (s === 'positive') return { label: 'Positive', cls: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' };
    if (s === 'negative') return { label: 'Negative', cls: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' };
    return { label: 'Neutral', cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' };
  }
}
