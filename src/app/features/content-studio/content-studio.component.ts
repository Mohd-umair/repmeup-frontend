import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { SocialPreviewComponent } from '../publish/social-preview/social-preview.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MediaSelectorModalComponent } from '../../shared/components/media-selector-modal/media-selector-modal.component';
import { Media } from '../../core/models/media.model';

export interface PlatformOption {
  id: string;
  name: string;
  icon: string;
}

export interface VariantItem {
  content: string;
  imageUrl?: string;
  loadingImage?: boolean;
  /** Set when image generation fails — drives the inline error card on the variant */
  imageError?: { code: string; message: string } | null;
}

export interface ImageConfig {
  style: string;
  mood: string;
  lighting: string;
  composition: string;
  colorPalette: string;
  cameraAngle: string;
  format: string;
}

export interface ImageStyleOption {
  id: string;
  label: string;
  icon: string;
  desc: string;
  accentColor: string;
  /** 3 representative sample URLs — shown in hover tooltip and selected preview panel */
  samples: string[];
}

@Component({
  selector: 'app-content-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SocialPreviewComponent, ButtonComponent, MediaSelectorModalComponent],
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

  // ─── Image Style System ──────────────────────────────────────────────────────

  imageConfig: ImageConfig = {
    style: '',
    mood: '',
    lighting: '',
    composition: '',
    colorPalette: '',
    cameraAngle: '',
    format: 'square'
  };

  showAdvancedImageConfig = false;

  /** Style chip the user is currently hovering — drives live preview update instantly */
  hoveredStyleId: string | null = null;

  /** Which sample (0-2) is shown large in the preview panel */
  previewSampleIndex = 0;

  /** Tracks failed sample image loads so we can show fallback */
  failedSamples = new Set<string>();

  // ─── Lightbox ────────────────────────────────────────────────────────────────
  lightboxUrl: string | null = null;
  lightboxLabel = '';
  /** All 3 sample URLs for the active style — used for prev/next navigation */
  lightboxUrls: string[] = [];
  lightboxIndex = 0;

  openLightbox(url: string, label: string, allUrls: string[], idx: number): void {
    this.lightboxUrl   = url;
    this.lightboxLabel = label;
    this.lightboxUrls  = allUrls;
    this.lightboxIndex = idx;
  }

  closeLightbox(): void { this.lightboxUrl = null; }

  lightboxNav(dir: 1 | -1): void {
    const len = this.lightboxUrls.length;
    this.lightboxIndex = (this.lightboxIndex + dir + len) % len;
    this.lightboxUrl   = this.lightboxUrls[this.lightboxIndex];
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.showImagePickerForVariant !== null) {
      if (e.key === 'Escape') this.closeImagePicker();
      return;
    }
    if (!this.lightboxUrl) return;
    if (e.key === 'Escape')      this.closeLightbox();
    if (e.key === 'ArrowRight')  this.lightboxNav(1);
    if (e.key === 'ArrowLeft')   this.lightboxNav(-1);
  }

  // ─── Image Picker (Media Library / Upload) ───────────────────────────────────
  /** Index of the variant currently requesting an image from the library; null = closed */
  showImagePickerForVariant: number | null = null;

  openImagePicker(variantIdx: number): void {
    this.showImagePickerForVariant = variantIdx;
  }

  closeImagePicker(): void {
    this.showImagePickerForVariant = null;
  }

  /** Called when the user confirms a selection inside MediaSelectorModal */
  onMediaSelected(media: Media | Media[]): void {
    const idx = this.showImagePickerForVariant;
    if (idx === null) return;
    const selected = Array.isArray(media) ? media[0] : media;
    if (selected?.publicUrl) {
      this.variants[idx].imageUrl   = selected.publicUrl;
      this.variants[idx].imageError = null;
      // Auto-select this variant's image for the preview panel
      this.selectedImageIndex = idx;
    }
    this.closeImagePicker();
  }

  /**
   * 3 representative sample URLs per style.
   * Seeds are stable so each style always shows the same set.
   * Replace with your own asset URLs in /assets/content-studio/styles/ at any time.
   */
  imageStyles: ImageStyleOption[] = [
    { id: 'photorealistic', label: 'Photorealistic', icon: 'fa-camera', accentColor: 'blue',
      desc: 'Ultra-sharp real-world photography, DSLR quality',
      samples: ['https://picsum.photos/seed/rop1a/480/480','https://picsum.photos/seed/rop1b/480/480','https://picsum.photos/seed/rop1c/480/480'] },
    { id: 'cinematic', label: 'Cinematic', icon: 'fa-film', accentColor: 'orange',
      desc: 'Film-grade color grading, dramatic anamorphic quality',
      samples: ['https://picsum.photos/seed/rop2a/480/480','https://picsum.photos/seed/rop2b/480/480','https://picsum.photos/seed/rop2c/480/480'] },
    { id: 'minimalist', label: 'Minimalist', icon: 'fa-minus', accentColor: 'gray',
      desc: 'Clean geometric forms, vast white space, pure simplicity',
      samples: ['https://picsum.photos/seed/rop3a/480/480','https://picsum.photos/seed/rop3b/480/480','https://picsum.photos/seed/rop3c/480/480'] },
    { id: '3d-render', label: '3D Render', icon: 'fa-cube', accentColor: 'cyan',
      desc: 'CGI depth, soft ambient occlusion, ray-traced realism',
      samples: ['https://picsum.photos/seed/rop4a/480/480','https://picsum.photos/seed/rop4b/480/480','https://picsum.photos/seed/rop4c/480/480'] },
    { id: 'illustration', label: 'Illustration', icon: 'fa-pen-nib', accentColor: 'yellow',
      desc: 'Flat / vector digital art, modern graphic style',
      samples: ['https://picsum.photos/seed/rop5a/480/480','https://picsum.photos/seed/rop5b/480/480','https://picsum.photos/seed/rop5c/480/480'] },
    { id: 'corporate', label: 'Corporate', icon: 'fa-briefcase', accentColor: 'indigo',
      desc: 'Polished professional business aesthetic, executive quality',
      samples: ['https://picsum.photos/seed/rop6a/480/480','https://picsum.photos/seed/rop6b/480/480','https://picsum.photos/seed/rop6c/480/480'] },
    { id: 'futuristic', label: 'Futuristic', icon: 'fa-rocket', accentColor: 'violet',
      desc: 'Neon-lit cyberpunk, holographic UI, sci-fi tech aesthetic',
      samples: ['https://picsum.photos/seed/rop7a/480/480','https://picsum.photos/seed/rop7b/480/480','https://picsum.photos/seed/rop7c/480/480'] },
    { id: 'vintage', label: 'Vintage', icon: 'fa-clock-rotate-left', accentColor: 'amber',
      desc: 'Analog film grain, faded warm palette, nostalgic retro feel',
      samples: ['https://picsum.photos/seed/rop8a/480/480','https://picsum.photos/seed/rop8b/480/480','https://picsum.photos/seed/rop8c/480/480'] },
    { id: 'bold-graphic', label: 'Bold Graphic', icon: 'fa-bolt', accentColor: 'red',
      desc: 'High-contrast poster art, editorial punch, strong geometry',
      samples: ['https://picsum.photos/seed/rop9a/480/480','https://picsum.photos/seed/rop9b/480/480','https://picsum.photos/seed/rop9c/480/480'] },
    { id: 'watercolor', label: 'Watercolor', icon: 'fa-droplet', accentColor: 'teal',
      desc: 'Soft expressive brushstrokes, artistic paper texture',
      samples: ['https://picsum.photos/seed/rop10a/480/480','https://picsum.photos/seed/rop10b/480/480','https://picsum.photos/seed/rop10c/480/480'] },
    { id: 'dark-moody', label: 'Dark & Moody', icon: 'fa-moon', accentColor: 'slate',
      desc: 'Deep shadows, chiaroscuro noir drama, cinematic atmosphere',
      samples: ['https://picsum.photos/seed/rop11a/480/480','https://picsum.photos/seed/rop11b/480/480','https://picsum.photos/seed/rop11c/480/480'] },
    { id: 'pastel-life', label: 'Pastel Life', icon: 'fa-sun', accentColor: 'pink',
      desc: 'Bright airy lifestyle, soft pastel tones, consumer-friendly warmth',
      samples: ['https://picsum.photos/seed/rop12a/480/480','https://picsum.photos/seed/rop12b/480/480','https://picsum.photos/seed/rop12c/480/480'] }
  ];

  moodOptions       = ['Energetic', 'Calm', 'Inspiring', 'Professional', 'Playful', 'Mysterious', 'Luxurious', 'Friendly'];
  lightingOptions   = ['Natural Daylight', 'Golden Hour', 'Studio Lighting', 'Dramatic Shadows', 'Neon Glow', 'Soft Diffused', 'Backlit'];
  compositionOptions= ['Rule of Thirds', 'Centered Symmetry', 'Close-up Detail', 'Wide Shot', 'Flat Lay', 'Dynamic Diagonal'];
  colorPaletteOptions = ['Vibrant', 'Monochrome', 'Pastel & Soft', 'Earthy Tones', 'Cool Blues', 'Warm Oranges', 'High Contrast B&W'];
  cameraAngleOptions  = ['Eye Level', "Bird's Eye", 'Low Angle Hero', 'Close-up Macro', 'Isometric'];
  formatOptions       = [
    { id: 'square',    label: '1:1',  tooltip: 'Square — Instagram' },
    { id: 'portrait',  label: '4:5',  tooltip: 'Portrait — IG Feed' },
    { id: 'landscape', label: '16:9', tooltip: 'Landscape — LinkedIn' },
    { id: 'story',     label: '9:16', tooltip: 'Story / Reel' }
  ];

  // ─── Visual Style Selection & Preview ─────────────────────────────────────

  /** Toggle-select a style chip; resets sample index so previews feel fresh */
  selectVisualStyle(styleId: string): void {
    this.imageConfig.style = this.imageConfig.style === styleId ? '' : styleId;
    this.previewSampleIndex = 0;
    this.failedSamples.clear();
  }

  /** Called on chip mouseenter — instantly updates the preview panel */
  hoverStyle(styleId: string): void {
    this.hoveredStyleId = styleId;
  }

  /** Called on chip mouseleave — reverts preview to selected style */
  unhoverStyle(): void {
    this.hoveredStyleId = null;
  }

  /** The style driving the preview panel: hovered takes priority over selected */
  get activePreviewStyle(): ImageStyleOption | null {
    const id = this.hoveredStyleId || this.imageConfig.style;
    return id ? (this.imageStyles.find(s => s.id === id) ?? null) : null;
  }

  /**
   * Returns a sample URL for a given variation index (0-2).
   * - No advanced filters → use the static style sample at that index.
   * - Any filter active → build a deterministic picsum seed combining all options
   *   + the variation index, so all 3 thumbnails AND the main image each show
   *   a different image that reflects the same filter combination.
   */
  getSampleUrl(idx: number, size: 1200 | 480 | 120 = 480): string {
    const style = this.activePreviewStyle;
    if (!style) return '';
    const c = this.imageConfig;
    const hasFilters = !this.hoveredStyleId &&
      (c.mood || c.lighting || c.composition || c.colorPalette || c.cameraAngle);
    if (!hasFilters) {
      const url = style.samples[idx] ?? style.samples[0];
      // Static samples are stored at /480/480 — rewrite to the requested size
      return url.replace('/480/480', `/${size}/${size}`);
    }
    const seed = [style.id, c.mood || 'x', c.lighting || 'x', c.composition || 'x',
                  c.colorPalette || 'x', c.cameraAngle || 'x', `v${idx}`]
      .join('-').replace(/\s+/g, '').toLowerCase();
    return `https://picsum.photos/seed/${seed}/${size}/${size}`;
  }

  /** Convenience getter for the big preview image (respects hover vs selected index) */
  get dynamicPreviewUrl(): string {
    return this.getSampleUrl(this.hoveredStyleId ? 0 : this.previewSampleIndex);
  }

  /**
   * CSS filter string that visually simulates the selected Mood + Lighting + Palette
   * on the preview image without requiring a new AI call.
   */
  get previewCssFilter(): string {
    const moodFilters: Record<string, string> = {
      'Energetic':    'brightness(1.1) saturate(1.4) contrast(1.05)',
      'Calm':         'brightness(0.97) saturate(0.75) contrast(0.95)',
      'Inspiring':    'brightness(1.05) saturate(1.15) contrast(1.05)',
      'Professional': 'saturate(0.65) brightness(0.97) contrast(1.05)',
      'Playful':      'saturate(1.5) brightness(1.08) hue-rotate(10deg)',
      'Mysterious':   'brightness(0.72) contrast(1.25) saturate(0.9)',
      'Luxurious':    'contrast(1.1) brightness(0.95) saturate(1.1)',
      'Friendly':     'brightness(1.08) saturate(1.2) contrast(0.97)',
    };
    const lightingFilters: Record<string, string> = {
      'Natural Daylight': '',
      'Golden Hour':      'sepia(0.3) brightness(1.12)',
      'Studio Lighting':  'contrast(1.12) brightness(1.06)',
      'Dramatic Shadows': 'contrast(1.35) brightness(0.82)',
      'Neon Glow':        'saturate(1.6) brightness(1.12) contrast(1.08)',
      'Soft Diffused':    'brightness(1.1) contrast(0.88)',
      'Backlit':          'brightness(1.25) contrast(0.88)',
    };
    const paletteFilters: Record<string, string> = {
      'Vibrant':              'saturate(1.5)',
      'Monochrome':           'saturate(0) contrast(1.1)',
      'Pastel & Soft':        'saturate(0.7) brightness(1.1)',
      'Earthy Tones':         'sepia(0.4) saturate(0.85)',
      'Cool Blues':           'hue-rotate(20deg) saturate(1.1)',
      'Warm Oranges':         'hue-rotate(-20deg) saturate(1.2) brightness(1.05)',
      'High Contrast B&W':    'saturate(0) contrast(1.5)',
    };
    const c = this.imageConfig;
    const parts: string[] = [];
    if (c.mood && moodFilters[c.mood])           parts.push(moodFilters[c.mood]);
    if (c.lighting && lightingFilters[c.lighting]) parts.push(lightingFilters[c.lighting]);
    if (c.colorPalette && paletteFilters[c.colorPalette]) parts.push(paletteFilters[c.colorPalette]);
    return parts.filter(Boolean).join(' ') || 'none';
  }

  /** All selected advanced filter options displayed as badges in the preview */
  get activeFilterBadges(): { label: string; value: string; icon: string }[] {
    const c = this.imageConfig;
    const f: { label: string; value: string; icon: string }[] = [];
    if (c.mood)         f.push({ label: 'Mood',    value: c.mood,         icon: 'fa-face-smile' });
    if (c.lighting)     f.push({ label: 'Light',   value: c.lighting,     icon: 'fa-lightbulb' });
    if (c.composition)  f.push({ label: 'Comp',    value: c.composition,  icon: 'fa-crop' });
    if (c.colorPalette) f.push({ label: 'Palette', value: c.colorPalette, icon: 'fa-palette' });
    if (c.cameraAngle)  f.push({ label: 'Angle',   value: c.cameraAngle,  icon: 'fa-video' });
    return f;
  }

  get hasAdvancedFilters(): boolean {
    const c = this.imageConfig;
    return !!(c.mood || c.lighting || c.composition || c.colorPalette || c.cameraAngle);
  }

  /** Cycle to a specific sample in the preview panel */
  setPreviewSample(idx: number): void {
    this.previewSampleIndex = idx;
  }

  /** Fallback: mark a sample URL as failed so we show a placeholder instead */
  markSampleFailed(url: string): void {
    this.failedSamples.add(url);
  }

  isSampleFailed(url: string): boolean {
    return this.failedSamples.has(url);
  }

  randomizeImageConfig(): void {
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    this.imageConfig = {
      style:        pick(this.imageStyles).id,
      mood:         pick(this.moodOptions),
      lighting:     pick(this.lightingOptions),
      composition:  pick(this.compositionOptions),
      colorPalette: pick(this.colorPaletteOptions),
      cameraAngle:  pick(this.cameraAngleOptions),
      format:       pick(this.formatOptions).id
    };
    this.previewSampleIndex = 0;
    this.failedSamples.clear();
  }

  clearImageConfig(): void {
    this.imageConfig = { style: '', mood: '', lighting: '', composition: '', colorPalette: '', cameraAngle: '', format: 'square' };
    this.previewSampleIndex = 0;
    this.failedSamples.clear();
  }

  get hasImageConfig(): boolean {
    return !!(this.imageConfig.style || this.imageConfig.mood || this.imageConfig.lighting);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

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
    this.variants.forEach(v => { v.loadingImage = true; v.imageError = null; });
    let completed = 0;

    this.variants.forEach((v, idx) => {
      this.http.post<{ success: boolean; imageUrl: string }>(
        `${environment.apiUrl}/posts/generate-variant-image`,
        { topic, variantContent: v.content, imageConfig: this.imageConfig, variantIndex: idx }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success && res.imageUrl) this.variants[idx].imageUrl = res.imageUrl;
          this.variants[idx].loadingImage = false;
          if (++completed === this.variants.length) { this.generatingImages = false; this.loadCredits(); }
        },
        error: (err) => {
          this.variants[idx].loadingImage = false;
          this.variants[idx].imageError = this.parseImageError(err);
          if (++completed === this.variants.length) { this.generatingImages = false; this.loadCredits(); }
        }
      });
    });
  }

  /** Generate an image for a single variant on demand */
  generateImageForVariant(idx: number): void {
    if (this.variants[idx]?.loadingImage) return;
    this.variants[idx].loadingImage = true;
    this.variants[idx].imageError = null;
    this.http.post<{ success: boolean; imageUrl: string }>(
      `${environment.apiUrl}/posts/generate-variant-image`,
      { topic: this.topic.trim(), variantContent: this.variants[idx].content, imageConfig: this.imageConfig, variantIndex: idx }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.imageUrl) {
          this.variants[idx].imageUrl = res.imageUrl;
          if (this.selectedImageIndex === null) this.selectedImageIndex = idx;
        }
        this.variants[idx].loadingImage = false;
        this.loadCredits();
      },
      error: (err) => {
        this.variants[idx].loadingImage = false;
        this.variants[idx].imageError = this.parseImageError(err);
      }
    });
  }

  /** Normalise an HTTP error into a typed imageError object */
  private parseImageError(err: any): { code: string; message: string } {
    const body = err?.error;
    const code = body?.code || 'IMAGE_FAILED';
    const message = body?.message || 'Could not generate image for this variant. Please try again.';
    return { code, message };
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
