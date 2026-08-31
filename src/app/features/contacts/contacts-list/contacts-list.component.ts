import {
  Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, map } from 'rxjs/operators';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ContactService } from '../../../core/services/contact.service';
import { InboxAvatarService } from '../../../core/services/inbox-avatar.service';
import { IContact } from '../../../core/models/contact.model';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import {
  COMING_SOON_PLATFORM_LABEL,
  isComingSoonPlatform
} from '../../../core/constants/platform-availability.constants';

const PLATFORMS = ['instagram', 'facebook', 'whatsapp', 'youtube', 'google', 'linkedin'];

@Component({
  selector: 'app-contacts-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './contacts-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactsListComponent implements OnInit, OnDestroy {
  @Output() contactSelected = new EventEmitter<IContact>();

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

  /** Hide broken avatar img and show initials fallback */
  avatarErrors: Record<string, boolean> = {};

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private contactService: ContactService,
    private avatarService: InboxAvatarService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadContacts();
    });
    this.loadContacts();
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
      page: this.currentPage,
      limit: this.pageSize
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

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  onPlatformFilter(platform: string): void {
    if (isComingSoonPlatform(platform)) return;
    this.selectedPlatform = this.selectedPlatform === platform ? '' : platform;
    this.currentPage = 1;
    this.loadContacts();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadContacts();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadContacts();
  }

  selectContact(contact: IContact): void {
    this.contactSelected.emit(contact);
  }

  isPlatformComingSoon(platform: string): boolean {
    return isComingSoonPlatform(platform);
  }

  platformFilterTitle(platform: string): string {
    return this.isPlatformComingSoon(platform) ? `${platform} — ${this.comingSoonLabel}` : platform;
  }

  getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      instagram: 'fa-instagram',
      facebook: 'fa-facebook',
      whatsapp: 'fa-whatsapp',
      youtube: 'fa-youtube',
      google: 'fa-google',
      linkedin: 'fa-linkedin',
      twitter: 'fa-twitter'
    };
    return icons[platform] || 'fa-globe';
  }

  getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      instagram: 'text-pink-500',
      facebook: 'text-blue-600',
      whatsapp: 'text-green-500',
      youtube: 'text-red-500',
      google: 'text-yellow-500',
      linkedin: 'text-blue-700',
      twitter: 'text-sky-500'
    };
    return colors[platform] || 'text-gray-500';
  }

  /** Profile image via backend proxy when needed (Graph URLs are not browser-loadable). */
  getContactAvatarUrl$(contact: IContact): Observable<SafeUrl | null> {
    return this.avatarService.getContactAvatarUrl$(contact).pipe(
      map(url => (url ? this.sanitizer.bypassSecurityTrustUrl(url) : null))
    );
  }

  onContactAvatarError(contactId: string): void {
    this.avatarErrors = { ...this.avatarErrors, [contactId]: true };
    this.cdr.markForCheck();
  }

  getInitials(name: string): string {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

}
