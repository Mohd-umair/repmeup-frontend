import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { SocialPreviewComponent } from '../publish/social-preview/social-preview.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

export interface PlatformOption {
  id: string;
  name: string;
  icon: string;
}

export interface VariantItem {
  content: string;
  imageUrl?: string;
  loadingImage?: boolean;
}

@Component({
  selector: 'app-content-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SocialPreviewComponent, ButtonComponent],
  templateUrl: './content-studio.component.html',
  styleUrls: ['./content-studio.component.scss']
})
export class ContentStudioComponent implements OnInit, OnDestroy {
  topic = '';
  audience = '';
  intent: 'Awareness' | 'Offer' | 'Education' | '' = '';
  platforms: PlatformOption[] = [];
  selectedPlatformIds: string[] = [];
  includeTrend = false;
  includeImage = false;

  generating = false;
  generatingImages = false;

  variants: VariantItem[] = [];

  /** Index of the variant whose TEXT is selected for the preview / publish */
  selectedTextIndex = 0;
  /** Index of the variant whose IMAGE is selected (null = no image) */
  selectedImageIndex: number | null = null;
  /** Inline-editable copy of the chosen text */
  editedContent = '';

  previewPlatform: PlatformOption | null = null;
  scheduleDate = '';
  scheduleTime = '';
  showScheduleModal = false;
  sendingToApproval = false;
  scheduling = false;
  publishing = false;
  aiCredits: any = null;

  intentOptions = [
    { value: 'Awareness', label: 'Awareness' },
    { value: 'Offer', label: 'Offer' },
    { value: 'Education', label: 'Education' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadPlatforms();
    this.loadCredits();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(q => {
      if (q['topic']) this.topic = q['topic'];
      if (q['trend']) this.includeTrend = true;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Data Loading ──────────────────────────────────────────────────────────

  loadPlatforms(): void {
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const nameMap: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
            const iconMap: Record<string, string> = { instagram: 'fab fa-instagram', facebook: 'fab fa-facebook', linkedin: 'fab fa-linkedin' };
            const seen = new Map<string, PlatformOption>();
            for (const c of res.data.filter((c: any) => c.status === 'connected')) {
              const id = c.platform?.toLowerCase();
              if (id && !seen.has(id)) seen.set(id, { id, name: nameMap[id] || c.platform, icon: iconMap[id] || 'fas fa-share-alt' });
            }
            this.platforms = Array.from(seen.values());
            if (this.platforms.length && !this.previewPlatform) this.previewPlatform = this.platforms[0];
          }
        }
      });
  }

  loadCredits(): void {
    this.http.get<any>(`${environment.apiUrl}/users/ai-credits`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (res) => { this.aiCredits = res.credits || null; } });
  }

  togglePlatform(id: string): void {
    this.selectedPlatformIds = this.selectedPlatformIds.includes(id)
      ? this.selectedPlatformIds.filter(p => p !== id)
      : [...this.selectedPlatformIds, id];
  }

  // ─── Generation ────────────────────────────────────────────────────────────

  generateVariants(): void {
    if (!this.topic.trim() || this.selectedPlatformIds.length === 0) return;
    this.generating = true;
    this.generatingImages = false;
    this.variants = [];
    this.selectedTextIndex = 0;
    this.selectedImageIndex = null;
    this.editedContent = '';

    this.http.post<{ success: boolean; data: { variants: VariantItem[] } }>(
      `${environment.apiUrl}/posts/generate-variants`,
      {
        topic: this.topic.trim(),
        platforms: this.selectedPlatformIds,
        count: 3,
        audience: this.audience.trim(),
        intent: this.intent || undefined,
        includeTrend: this.includeTrend
      }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.generating = false;
        if (res.success && res.data?.variants) {
          this.variants = res.data.variants.map(v => ({ ...v, loadingImage: false }));
          this.selectedTextIndex = 0;
          this.editedContent = this.variants[0]?.content || '';
          this.loadCredits();
          if (this.includeImage) this.fetchImagesForVariants();
        }
      },
      error: (err) => {
        this.generating = false;
        this.notify.error('Generation Failed', err?.error?.message || 'Failed to generate variants.');
      }
    });
  }

  fetchImagesForVariants(): void {
    this.generatingImages = true;
    const topic = this.topic.trim();
    this.variants.forEach(v => { v.loadingImage = true; });
    let completed = 0;

    this.variants.forEach((v, idx) => {
      this.http.post<{ success: boolean; imageUrl: string }>(
        `${environment.apiUrl}/posts/generate-variant-image`,
        { topic, variantContent: v.content }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success && res.imageUrl) this.variants[idx].imageUrl = res.imageUrl;
          this.variants[idx].loadingImage = false;
          if (++completed === this.variants.length) { this.generatingImages = false; this.loadCredits(); }
        },
        error: () => {
          this.variants[idx].loadingImage = false;
          if (++completed === this.variants.length) { this.generatingImages = false; this.loadCredits(); }
        }
      });
    });
  }

  /** Generate an image for a single variant on demand */
  generateImageForVariant(idx: number): void {
    if (this.variants[idx]?.loadingImage) return;
    this.variants[idx].loadingImage = true;
    this.http.post<{ success: boolean; imageUrl: string }>(
      `${environment.apiUrl}/posts/generate-variant-image`,
      { topic: this.topic.trim(), variantContent: this.variants[idx].content }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.imageUrl) {
          this.variants[idx].imageUrl = res.imageUrl;
          if (this.selectedImageIndex === null) this.selectedImageIndex = idx;
        }
        this.variants[idx].loadingImage = false;
        this.loadCredits();
      },
      error: () => {
        this.variants[idx].loadingImage = false;
        this.notify.error('Image Failed', 'Could not generate image for this variant.');
      }
    });
  }

  // ─── Selection Helpers ─────────────────────────────────────────────────────

  selectText(idx: number): void {
    this.selectedTextIndex = idx;
    this.editedContent = this.variants[idx]?.content || '';
  }

  selectImage(idx: number): void {
    this.selectedImageIndex = this.selectedImageIndex === idx ? null : idx;
  }

  get selectedContent(): string {
    return this.editedContent || this.variants[this.selectedTextIndex]?.content || '';
  }

  get selectedImageUrl(): string | undefined {
    return this.selectedImageIndex !== null ? this.variants[this.selectedImageIndex]?.imageUrl : undefined;
  }

  get hasAnyImage(): boolean {
    return this.variants.some(v => !!v.imageUrl);
  }

  getPreviewPlatform(): PlatformOption {
    return this.previewPlatform || this.platforms[0] || { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram' };
  }

  getPreviewMedia(): { preview: string; type: 'image' }[] {
    return this.selectedImageUrl ? [{ preview: this.selectedImageUrl, type: 'image' }] : [];
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  openAddToCalendar(): void { this.showScheduleModal = true; }

  addToCalendar(): void {
    const content = this.selectedContent;
    const platform = this.selectedPlatformIds[0];
    if (!content || !platform) return;
    const scheduledFor = this.scheduleDate && this.scheduleTime
      ? new Date(`${this.scheduleDate}T${this.scheduleTime}`).toISOString() : null;
    if (!scheduledFor) return;
    this.scheduling = true;
    const body: any = { platform, content, scheduledFor, postType: 'post' };
    if (this.selectedImageUrl) body.mediaUrl = this.selectedImageUrl;
    this.http.post<any>(`${environment.apiUrl}/posts/schedule`, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showScheduleModal = false; this.scheduleDate = ''; this.scheduleTime = '';
          this.scheduling = false;
          this.notify.success('Scheduled', 'Post scheduled successfully.');
        },
        error: (err) => { this.scheduling = false; this.notify.error('Schedule Failed', err?.error?.message || 'Failed to schedule.'); }
      });
  }

  publishNow(): void {
    const content = this.selectedContent;
    if (!content || !this.selectedPlatformIds.length) return;
    this.publishing = true;
    const calls = this.selectedPlatformIds.map(platformId => {
      const body: any = { platform: platformId, content, postType: 'post' };
      if (this.selectedImageUrl) body.mediaUrl = this.selectedImageUrl;
      return this.http.post<any>(`${environment.apiUrl}/posts/publish`, body);
    });
    forkJoin(calls).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.publishing = false; this.notify.success('Published', 'Post published successfully.'); },
      error: (err) => { this.publishing = false; this.notify.error('Publish Failed', err?.error?.message || 'Failed to publish.'); }
    });
  }

  sendToApproval(): void {
    const content = this.selectedContent;
    const platform = this.selectedPlatformIds[0];
    if (!content || !platform) return;
    this.sendingToApproval = true;
    const body: any = { platform, content, generatedBy: 'ai', originalContent: this.variants[this.selectedTextIndex]?.content };
    if (this.selectedImageUrl) body.mediaUrl = this.selectedImageUrl;
    this.http.post<any>(`${environment.apiUrl}/posts/to-approval`, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.sendingToApproval = false; this.notify.success('Sent', 'Post sent to approval queue.'); },
        error: (err) => { this.sendingToApproval = false; this.notify.error('Failed', err?.error?.message || 'Failed to send.'); }
      });
  }
}
