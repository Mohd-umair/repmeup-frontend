import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import {
  ReviewCollectionService,
  IReviewCollectionSettings,
  IReviewPlatform,
  IReviewStats
} from '../../../core/services/review-collection.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutomationPageShellComponent } from '../shared/automation-page-shell.component';
import { ALL_CHANNELS } from '../shared/automation-channel-toggle.component';
import { AutomationSwitchComponent } from '../shared/automation-switch.component';
import {
  COMING_SOON_PLATFORM_LABEL,
  isComingSoonPlatform
} from '../../../core/constants/platform-availability.constants';

const PLATFORM_DEFS = [
  { key: 'google', label: 'Google Reviews', icon: 'fab fa-google', color: 'text-red-500', comingSoon: true },
  { key: 'facebook', label: 'Facebook', icon: 'fab fa-facebook', color: 'text-blue-600' },
  { key: 'tripadvisor', label: 'TripAdvisor', icon: 'fas fa-plane', color: 'text-emerald-600' },
  { key: 'custom', label: 'Custom URL', icon: 'fas fa-link', color: 'text-purple-500' }
];

@Component({
  selector: 'app-review-collection',
  standalone: true,
  imports: [CommonModule, FormsModule, AutomationPageShellComponent, AutomationSwitchComponent],
  templateUrl: './review-collection.component.html',
  styleUrls: ['./review-collection.component.scss']
})
export class ReviewCollectionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly comingSoonLabel = COMING_SOON_PLATFORM_LABEL;

  loading = true;
  saving = false;
  statsLoading = true;

  platformDefs = PLATFORM_DEFS;
  sendChannels = ALL_CHANNELS.filter(c => ['whatsapp', 'email', 'sms'].includes(c.key));

  settings: IReviewCollectionSettings = {
    enabled: false,
    platforms: PLATFORM_DEFS.map(p => ({ key: p.key, active: false, url: '' })),
    trigger: 'after_purchase',
    delayDays: 3,
    channels: ['whatsapp'],
    language: 'en',
    message: 'Hi {{customer_name}}! 😊 We hope you loved your experience. If you have a moment, we\'d really appreciate a quick review. {{review_link}}',
    sendReminders: false,
    reminderCount: 1,
    ignoreNegativeRating: true,
    excludeRecentReviewers: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00'
  };

  stats: IReviewStats | null = null;
  activeTab: 'setup' | 'platforms' | 'message' | 'filters' = 'setup';

  constructor(
    private reviewService: ReviewCollectionService,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.reviewService.getSettings()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.loading = false; }))
      .subscribe({
        next: r => {
          if (!r.data) return;
          this.settings = {
            ...this.settings,
            ...r.data,
            platforms: this.normalizePlatformsFromApi(r.data.platforms).map(p =>
              this.isPlatformComingSoon(p.key) ? { ...p, active: false } : p
            )
          };
        }
      });

    this.reviewService.getStats()
      .pipe(takeUntil(this.destroy$), finalize(() => { this.statsLoading = false; }))
      .subscribe({ next: r => { this.stats = this.normalizeStats(r.data); } });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  save(): void {
    this.saving = true;
    this.reviewService.updateSettings(this.settings)
      .pipe(takeUntil(this.destroy$), finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => this.notify.success('Saved', 'Review collection settings saved.'),
        error: err => this.notify.error('Error', err?.error?.error || 'Failed to save.')
      });
  }

  isChannelEnabled(key: string): boolean {
    return (this.settings.channels || []).includes(key);
  }

  toggleChannel(key: string): void {
    const chs = [...(this.settings.channels || [])];
    const idx = chs.indexOf(key);
    if (idx >= 0) chs.splice(idx, 1); else chs.push(key);
    this.settings = { ...this.settings, channels: chs };
  }

  getPlatformDef(key: string) {
    return PLATFORM_DEFS.find(p => p.key === key) ?? PLATFORM_DEFS[0];
  }

  isPlatformComingSoon(key: string): boolean {
    return isComingSoonPlatform(key) || !!this.getPlatformDef(key)?.comingSoon;
  }

  get previewMessage(): string {
    return (this.settings.message || '')
      .replace(/\{\{customer_name\}\}/g, 'Alex')
      .replace(/\{\{review_link\}\}/g, 'https://g.page/review/...');
  }

  /** API may return counts as plain numbers or `{ value, change }` KPI objects. */
  private normalizeStats(raw: IReviewStats | null | undefined): IReviewStats | null {
    if (!raw) return null;
    return {
      ...raw,
      requestsSent: this.statToNumber(raw.requestsSent),
      reviewsReceived: this.statToNumber(raw.reviewsReceived),
      conversionRate: typeof raw.conversionRate === 'number' ? raw.conversionRate : 0,
      avgRating: typeof raw.avgRating === 'number' ? raw.avgRating : 0
    };
  }

  private statToNumber(v: number | { value: number; change?: number } | undefined | null): number {
    if (v == null) return 0;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'number') {
      return Number((v as { value: number }).value) || 0;
    }
    return 0;
  }

  /** Keep only platforms we support in UI; drop legacy entries (e.g. trustpilot). */
  private normalizePlatformsFromApi(fromApi?: IReviewPlatform[]): IReviewPlatform[] {
    const allowed = new Set(PLATFORM_DEFS.map(p => p.key));
    const byKey = new Map((fromApi || []).filter(p => allowed.has(p.key)).map(p => [p.key, p]));
    return PLATFORM_DEFS.map(def => {
      const existing = byKey.get(def.key);
      return existing
        ? { key: def.key, active: !!existing.active, url: existing.url || '' }
        : { key: def.key, active: false, url: '' };
    });
  }
}
