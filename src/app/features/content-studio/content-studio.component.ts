import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subject, Subscription, takeUntil, timer, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { SocialPreviewComponent } from '../publish/social-preview/social-preview.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { MediaSelectorModalComponent } from '../../shared/components/media-selector-modal/media-selector-modal.component';
import { PostEditorComponent, PostEditorOutput } from '../post-editor/post-editor.component';
import { Media } from '../../core/models/media.model';

export interface EventTemplateItem {
  _id: string;
  name: string;
  eventType: string;
  referenceImageUrl: string | null;
  sampleCaption?: string;
  hashtags?: string[];
  cta?: string;
  eventStyle: {
    dominantColors?: string[];
    decorativeElements?: string[];
    mood?: string;
    typography?: string;
    layoutPattern?: string;
  } | null;
  isActive: boolean;
  createdAt: string;
}

export const EVENT_TYPE_OPTIONS = [
  { id: 'christmas', label: 'Christmas', icon: 'fa-tree' },
  { id: 'new_year', label: 'New Year', icon: 'fa-champagne-glasses' },
  { id: 'eid', label: 'Eid', icon: 'fa-moon' },
  { id: 'ramadan', label: 'Ramadan', icon: 'fa-star-and-crescent' },
  { id: 'diwali', label: 'Diwali', icon: 'fa-fire' },
  { id: 'national_day', label: 'National Day', icon: 'fa-flag' },
  { id: 'black_friday', label: 'Black Friday', icon: 'fa-tags' },
  { id: 'cyber_monday', label: 'Cyber Monday', icon: 'fa-laptop' },
  { id: 'valentines', label: "Valentine's", icon: 'fa-heart' },
  { id: 'mothers_day', label: "Mother's Day", icon: 'fa-heart' },
  { id: 'fathers_day', label: "Father's Day", icon: 'fa-user' },
  { id: 'halloween', label: 'Halloween', icon: 'fa-ghost' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: 'fa-wheat-awn' },
  { id: 'custom', label: 'Custom', icon: 'fa-calendar-plus' }
];


export interface PlatformOption {
  id: string;
  name: string;
  icon: string;
}

export interface DesignDna {
  generationPrompt: string | null;
  layoutType: string | null;
  colors: string[];
  medium: string | null;
  style: string | null;
}

export interface VariantItem {
  content: string;
  imageUrl?: string;
  loadingImage?: boolean;
  savedToLibrary?: boolean;
  /** Design DNA captured from the image generation response for the learning loop */
  designDna?: DesignDna | null;
  /** Set when image generation fails — drives the inline error card on the variant */
  imageError?: { code: string; message: string } | null;
  videoUrl?: string;
  loadingVideo?: boolean;
  videoJobId?: string;
  videoProgress?: number;
  videoError?: { code: string; message: string } | null;
}

export interface VideoConfig {
  duration: 4 | 8 | 12;
  aspect: '16:9' | '9:16';
  style: string;
  tone: string;
}

export interface ImageConfig {
  format: string;
}

@Component({
  selector: 'app-content-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SocialPreviewComponent, ButtonComponent, MediaSelectorModalComponent, PostEditorComponent],
  templateUrl: './content-studio.component.html',
  styleUrls: ['./content-studio.component.scss']
})
export class ContentStudioComponent implements OnInit, OnDestroy {
  // ─── Mode & Flow State ───────────────────────────────────────────────────────
  contentMode: 'ai' | 'custom' = 'ai';
  postFormat: 'post' | 'story' | 'reel' | 'video' | 'short' = 'post';
  contentType: 'text' | 'text-image' | 'text-video' | 'image-layover' = 'text';

  // ─── Generation Mode (4-tab selector) ────────────────────────────────────────
  generationMode: 'instant' | 'brand-voice' | 'reference' | 'template' = 'instant';
  brandVoiceInfo: { confidence: string; analyzedAt: string | null; hasProfile: boolean } | null = null;
  referenceImageCount = 0;
  loadingModeContext = false;
  templateUseMode: 'direct' | 'reference' = 'reference';

  // ─── Wizard Step State ───────────────────────────────────────────────────────
  currentStep = 1;
  completedSteps = new Set<number>();
  /** Whether to show the compact summary bar (post-generation) */
  showWizardSummary = false;

  get maxReachedStep(): number {
    if (this.selectedPlatformIds.length === 0) return 1;
    if (!this.contentType) return 2;
    if (!this.topic.trim()) return 3;
    return 4;
  }

  get isStepActive(): (n: number) => boolean {
    return (n: number) => this.currentStep === n;
  }

  get isStepDone(): (n: number) => boolean {
    return (n: number) => this.completedSteps.has(n);
  }

  get isStepLocked(): (n: number) => boolean {
    return (n: number) => n > this.maxReachedStep && !this.completedSteps.has(n) && this.currentStep !== n;
  }

  advanceStep(): void {
    this.completedSteps.add(this.currentStep);
    this.currentStep = Math.min(this.currentStep + 1, 4);
  }

  goToStep(n: number): void {
    if (n <= this.maxReachedStep || this.completedSteps.has(n)) {
      this.currentStep = n;
    }
  }

  editFromSummary(): void {
    if (this.variants.length > 0) {
      if (!confirm('Editing your setup will clear the generated variants. Continue?')) return;
      this.variants = [];
      this.selectedTextIndex = 0;
      this.selectedImageIndex = null;
      this.selectedVideoIndex = null;
      this.editedContent = '';
    }
    this.showWizardSummary = false;
    this.currentStep = 1;
  }

  get contentTypeLabel(): string {
    return this.contentTypeOptions.find(o => o.id === this.contentType)?.label ?? this.contentType;
  }

  get wizardSummaryLine(): string {
    const platforms = this.selectedPlatformIds.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    const fmt = this.postFormat.charAt(0).toUpperCase() + this.postFormat.slice(1);
    const ct = this.contentTypeOptions.find(o => o.id === this.contentType)?.label ?? this.contentType;
    const tp = this.topic.trim() ? `"${this.topic.trim().slice(0, 30)}${this.topic.trim().length > 30 ? '…' : ''}"` : '';
    return [platforms, fmt, ct, tp].filter(Boolean).join(' · ');
  }

  /** All possible post format options — filtered dynamically by selected platforms */
  private readonly allPostFormatOptions = [
    { id: 'post',  label: 'Post',  icon: 'fa-image',      platforms: ['instagram','facebook','linkedin'] },
    { id: 'story', label: 'Story', icon: 'fa-circle-dot', platforms: ['instagram','facebook'] },
    { id: 'reel',  label: 'Reel',  icon: 'fa-film',       platforms: ['instagram','facebook'] },
    { id: 'video', label: 'Video', icon: 'fa-video',      platforms: ['instagram','facebook','linkedin','youtube'] },
    { id: 'short', label: 'Short', icon: 'fa-bolt',       platforms: ['youtube'] },
  ];

  get postFormatOptions() {
    const ids = this.selectedPlatformIds.map(p => p.toLowerCase());
    let byPlatform = ids.length
      ? this.allPostFormatOptions.filter(o => o.platforms.some(p => ids.includes(p)))
      : this.allPostFormatOptions.filter(o => o.id !== 'short');
    if (!byPlatform.length) byPlatform = this.allPostFormatOptions.filter(o => o.id !== 'short');

    // Filter by content type: video/short only valid for text-video; exclude them otherwise
    if (this.contentType === 'text-video') {
      const videoFmts = byPlatform.filter(o => o.id === 'video' || o.id === 'reel' || o.id === 'short');
      return videoFmts.length ? videoFmts : byPlatform;
    } else {
      const nonVideoFmts = byPlatform.filter(o => o.id !== 'video' && o.id !== 'short');
      return nonVideoFmts.length ? nonVideoFmts : byPlatform;
    }
  }

  contentTypeOptions = [
    { id: 'text',          label: 'Text Only',              icon: 'fa-align-left',    desc: 'Pure text post, no media' },
    { id: 'text-image',    label: 'Text + Image',           icon: 'fa-image',         desc: 'AI-generated image with your text' },
    { id: 'text-video',    label: 'Text + Video',           icon: 'fa-video',         desc: 'AI-generated video reel (1 variant)' },
    { id: 'image-layover', label: 'Image with Text Layover', icon: 'fa-font',         desc: 'AI renders your headline into the image' },
  ];

  // ─── Logo Overlay ─────────────────────────────────────────────────────────────
  logoOverlay = false;
  logoPosition: string = 'bottom-right';
  orgLogo: string | null = null;
  showLogoPickerModal = false;

  logoPositions = [
    { id: 'top-left',      label: '↖', row: 1 },
    { id: 'top-center',    label: '↑', row: 1 },
    { id: 'top-right',     label: '↗', row: 1 },
    { id: 'bottom-left',   label: '↙', row: 2 },
    { id: 'bottom-center', label: '↓', row: 2 },
    { id: 'bottom-right',  label: '↘', row: 2 },
  ];

  topic = '';
  audience = '';
  intent = '';
  platforms: PlatformOption[] = [];
  selectedPlatformIds: string[] = [];
  includeTrend = false;
  includeImage = false;
  includeVideo = false;

  generating = false;
  generatingImages = false;
  generatingVideos = false;

  variants: VariantItem[] = [];

  /** Index of the variant whose TEXT is selected for the preview / publish */
  selectedTextIndex = 0;
  /** Index of the variant whose IMAGE is selected (null = no image) */
  selectedImageIndex: number | null = null;
  /** Index of the variant whose VIDEO is selected (null = no video) */
  selectedVideoIndex: number | null = null;
  /**
   * How the video will be posted.
   * Driven by the platform mix: Instagram/Facebook support reel|story|post,
   * YouTube supports video|short, LinkedIn only supports post.
   */
  videoPostType: 'reel' | 'story' | 'post' | 'video' | 'short' = 'reel';
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

  // ─── Image Config ────────────────────────────────────────────────────────────

  imageConfig: ImageConfig = { format: 'square' };

  // ─── Video Style System ──────────────────────────────────────────────────────

  videoConfig: VideoConfig = {
    duration: 4,
    aspect: '9:16',
    style: 'cinematic',
    tone: 'energetic'
  };

  videoStyleOptions = [
    { id: 'cinematic',    label: 'Cinematic',    icon: 'fa-film',          desc: 'Film-grade color grading, dramatic lighting' },
    { id: 'realistic',    label: 'Realistic',    icon: 'fa-camera',        desc: 'Ultra-realistic live action footage' },
    { id: 'animated',     label: 'Animated',     icon: 'fa-wand-sparkles', desc: 'Smooth 3D animation, modern motion graphics' },
    { id: 'documentary',  label: 'Documentary',  icon: 'fa-video',         desc: 'Authentic documentary-style footage' },
    { id: 'energetic',    label: 'Energetic',    icon: 'fa-bolt',          desc: 'Fast-paced dynamic edit, high energy motion' },
  ];

  videoToneOptions  = ['Energetic', 'Calm', 'Professional', 'Playful'];
  videoDurations    = [4, 8, 12] as const;
  videoAspectOptions = [
    { id: '9:16',  label: '9:16',  icon: 'fa-mobile-screen', tooltip: 'Reel / Story (Portrait)' },
    { id: '16:9',  label: '16:9',  icon: 'fa-display',       tooltip: 'Landscape' },
  ];

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.showImagePickerForVariant !== null) {
      if (e.key === 'Escape') this.closeImagePicker();
    }
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

  openLogoPicker(): void {
    this.showLogoPickerModal = true;
  }

  closeLogoPicker(): void {
    this.showLogoPickerModal = false;
  }

  onLogoMediaSelected(media: Media | Media[]): void {
    const selected = Array.isArray(media) ? media[0] : media;
    if (selected?.publicUrl) {
      this.orgLogo = selected.publicUrl;
    }
    this.closeLogoPicker();
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

  // ─── Helpers ────────────────────────────────────────────────────────────────

  intentOptions: { value: string; label: string }[] = [
    { value: 'Awareness', label: 'Awareness' },
    { value: 'Engagement', label: 'Engagement' },
    { value: 'Educational', label: 'Educational' },
    { value: 'Authority', label: 'Authority' },
    { value: 'Entertainment', label: 'Entertainment' },
    { value: 'Emotional', label: 'Emotional' },
    { value: 'Promotional', label: 'Promotional' },
    { value: 'Community', label: 'Community' },
    { value: 'Social Proof', label: 'Social Proof' },
    { value: 'Lead Generation', label: 'Lead Generation' },
    { value: 'Announcement', label: 'Announcement' },
    { value: 'Problem-Solution', label: 'Problem-Solution' },
    { value: 'Curiosity', label: 'Curiosity' },
    { value: 'Behind-the-Scenes', label: 'Behind-the-Scenes' },
    { value: 'Inspiration', label: 'Inspiration' },
    { value: 'Comparison', label: 'Comparison' }
  ];

  private destroy$ = new Subject<void>();
  /** Tracks active polling subscriptions per variant index so we can cancel them */
  private videoPolls = new Map<number, Subscription>();

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private notify: NotificationService,
    private authService: AuthService
  ) {}

  get isAgent(): boolean {
    return this.authService.currentUserValue?.role === 'agent';
  }

  get publishButtonLabel(): string {
    return this.isAgent ? 'Submit for Approval' : 'Publish Now';
  }

  ngOnInit(): void {
    this.loadPlatforms();
    this.loadCredits();
    this.loadOrgLogo();
    this.loadEventTemplates();
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(q => {
      if (q['topic']) this.topic = q['topic'];
      if (q['trend']) this.includeTrend = true;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.videoPolls.forEach((sub) => sub.unsubscribe());
    this.videoPolls.clear();
  }

  // ─── Data Loading ──────────────────────────────────────────────────────────

  loadPlatforms(): void {
    this.http.get<any>(`${environment.apiUrl}/platforms/connections`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            const nameMap: Record<string, string> = {
              instagram: 'Instagram', facebook: 'Facebook',
              linkedin: 'LinkedIn', youtube: 'YouTube'
            };
            const iconMap: Record<string, string> = {
              instagram: 'fab fa-instagram', facebook: 'fab fa-facebook',
              linkedin: 'fab fa-linkedin',   youtube: 'fab fa-youtube'
            };
            // 'google' is excluded — not a social post platform
            const excluded = new Set(['google', 'whatsapp']);
            const seen = new Map<string, PlatformOption>();
            for (const c of res.data.filter((c: any) => c.status === 'connected')) {
              const id = c.platform?.toLowerCase();
              if (id && !excluded.has(id) && !seen.has(id)) {
                seen.set(id, { id, name: nameMap[id] || c.platform, icon: iconMap[id] || 'fas fa-share-alt' });
              }
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

  loadOrgLogo(): void {
    this.http.get<any>(`${environment.apiUrl}/organizations/me`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const org = res.data || res.organization || res;
          this.orgLogo = org?.logo || org?.whiteLabel?.customLogo || null;
        }
      });
  }

  selectGenerationMode(mode: 'instant' | 'brand-voice' | 'reference' | 'template'): void {
    if (this.generationMode === mode) return;
    this.generationMode = mode;
    // Reset wizard when switching modes
    this.variants = [];
    this.editedContent = '';
    this.selectedTextIndex = 0;
    this.selectedImageIndex = null;
    this.selectedVideoIndex = null;
    this.showWizardSummary = false;
    this.completedSteps = new Set<number>();
    this.currentStep = 1;
    if (mode === 'template') {
      // Load templates if not yet loaded
      if (!this.eventTemplates.length && !this.eventTemplatesLoading) {
        this.loadEventTemplates();
      }
      this.selectedEventTemplateId = null;
      this.templateUseMode = 'reference';
    } else if (mode !== 'instant') {
      this.loadModeContextData();
    }
  }

  loadModeContextData(): void {
    this.loadingModeContext = true;
    this.http.get<any>(`${environment.apiUrl}/brand-config`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const cfg = res.data || res;
          const bp = cfg?.brandProfile;
          this.brandVoiceInfo = {
            hasProfile: !!(bp?.analyzedAt),
            confidence: bp?.confidence || 'low',
            analyzedAt: bp?.analyzedAt ? new Date(bp.analyzedAt).toLocaleDateString() : null
          };
        },
        error: () => { this.brandVoiceInfo = { hasProfile: false, confidence: 'low', analyzedAt: null }; }
      });

    this.http.get<any>(`${environment.apiUrl}/brand-config/reference-images`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.referenceImageCount = res.total ?? res.data?.length ?? 0;
          this.loadingModeContext = false;
        },
        error: () => { this.referenceImageCount = 0; this.loadingModeContext = false; }
      });
  }

  togglePlatform(id: string): void {
    this.selectedPlatformIds = this.selectedPlatformIds.includes(id)
      ? this.selectedPlatformIds.filter(p => p !== id)
      : [...this.selectedPlatformIds, id];
    this.normalisePostFormat();
    // Auto-advance to step 2 when at least one platform is selected
    if (this.selectedPlatformIds.length > 0 && this.currentStep === 1) {
      this.completedSteps.add(1);
    }
  }

  private normalisePostFormat(): void {
    const available = this.postFormatOptions.map(o => o.id);
    if (!available.includes(this.postFormat)) {
      this.postFormat = (available[0] as any) ?? 'post';
    }
  }

  // ─── Content Type & Mode ─────────────────────────────────────────────────────

  setContentType(type: 'text' | 'text-image' | 'text-video' | 'image-layover'): void {
    this.contentType = type;
    this.includeImage = type === 'text-image' || type === 'image-layover';
    this.includeVideo = type === 'text-video';

    // Sync postFormat: video/short only valid for text-video; reset if switching away
    const isVideoFormat = this.postFormat === 'video' || this.postFormat === 'short';
    if (type === 'text-video' && !isVideoFormat) {
      // Switching to video content type — default to 'video' format
      const available = this.postFormatOptions.map(o => o.id);
      this.postFormat = (available.find(id => id === 'video') ?? available[0] ?? 'video') as any;
    } else if (type !== 'text-video' && isVideoFormat) {
      // Switching away from video content type — reset to a non-video format
      const available = this.postFormatOptions.map(o => o.id);
      this.postFormat = (available.find(id => id === 'post') ?? available[0] ?? 'post') as any;
    }

    // Auto-advance to step 3 after picking content type
    if (this.currentStep === 2) {
      this.completedSteps.add(2);
      this.currentStep = 3;
    }
  }

  goToCustom(): void {
    this.router.navigate(['/app/publish']);
  }

  // ─── Variant count (user-configurable) ───────────────────────────────────────
  customVariantCount = 3;
  variantCountOptions = [1, 2, 3, 4, 5];

  // ─── Include people in design ─────────────────────────────────────────────────
  includePeople: boolean | null = null;
  peopleNationality = '';

  get variantCount(): number {
    return this.contentType === 'text-video' ? 1 : this.customVariantCount;
  }

  // ─── Generation ────────────────────────────────────────────────────────────

  generateVariants(): void {
    const isTemplateDirectMode = this.generationMode === 'template' && this.templateUseMode === 'direct';
    const isTemplatePlatformValid = this.selectedPlatformIds.length > 0;
    // In direct template mode, topic is optional; a selected template is required
    if (isTemplateDirectMode) {
      if (!this.selectedEventTemplateId || !isTemplatePlatformValid) return;
    } else {
      if (!this.topic.trim() || !isTemplatePlatformValid) return;
    }

    this.generatingImages = false;
    this.generatingVideos = false;
    this.variants = [];
    this.selectedTextIndex = 0;
    this.selectedImageIndex = null;
    this.selectedVideoIndex = null;
    this.editedContent = '';
    this.draftSaved = false;
    this.draftId = '';
    this.allDraftsSaved = false;
    this.allDraftsSavedCount = 0;

    // ── Direct template mode: use template content + reference image as-is, no AI calls ──
    if (isTemplateDirectMode && this.selectedEventTemplate) {
      this.generating = true;
      const tpl = this.selectedEventTemplate;
      const hashtagStr = (tpl.hashtags || []).map(h => h.startsWith('#') ? h : '#' + h).join(' ');
      const parts = [tpl.sampleCaption, hashtagStr, tpl.cta].filter(Boolean);
      const content = parts.join('\n\n');
      // Use the template's own reference image directly — no AI image generation
      this.variants = [{
        content,
        imageUrl: tpl.referenceImageUrl || undefined,
        loadingImage: false,
        loadingVideo: false
      }];
      this.selectedTextIndex = 0;
      this.editedContent = content;
      if (tpl.referenceImageUrl) {
        this.selectedImageIndex = 0;
      }
      this.completedSteps.add(3);
      this.completedSteps.add(4);
      this.showWizardSummary = true;
      this.generating = false;
      // No AI image or video generation — template content is used directly
      return;
    }

    this.generating = true;

    // Resolve the effective API generation mode for template reference usage
    const apiGenerationMode = this.generationMode === 'template' ? 'instant' : this.generationMode;

    this.http.post<{ success: boolean; data: { variants: VariantItem[] } }>(
      `${environment.apiUrl}/posts/generate-variants`,
      {
        topic: this.topic.trim() || (this.selectedEventTemplate?.name ?? ''),
        platforms: this.selectedPlatformIds,
        count: this.variantCount,
        audience: this.audience.trim(),
        intent: this.intent || undefined,
        includeTrend: this.includeTrend,
        postFormat: this.postFormat,
        contentType: this.contentType,
        generationMode: apiGenerationMode,
        eventTemplateId: this.selectedEventTemplateId || undefined
      }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.generating = false;
        if (res.success && res.data?.variants) {
          this.variants = res.data.variants.map(v => ({ ...v, loadingImage: false, loadingVideo: false }));
          this.selectedTextIndex = 0;
          this.editedContent = this.variants[0]?.content || '';
          this.completedSteps.add(3);
          this.completedSteps.add(4);
          this.showWizardSummary = true;
          this.loadCredits();
          if (this.includeImage) this.fetchImagesForVariants();
          if (this.includeVideo) this.fetchVideosForVariants();
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
    const topic = this.topic.trim() || (this.selectedEventTemplate?.name ?? '');
    const apiGenerationMode = this.generationMode === 'template' ? 'reference' : this.generationMode;
    this.variants.forEach(v => { v.loadingImage = true; v.imageError = null; v.savedToLibrary = false; });
    let completed = 0;

    this.variants.forEach((v, idx) => {
      this.http.post<{ success: boolean; imageUrl: string; savedToLibrary?: boolean; designDna?: DesignDna }>(
        `${environment.apiUrl}/posts/generate-variant-image`,
        {
          topic, variantContent: v.content, imageConfig: this.imageConfig, variantIndex: idx,
          contentType: this.contentType,
          generationMode: apiGenerationMode,
          logoOverlay: this.logoOverlay && !!this.orgLogo,
          logoPosition: this.logoPosition,
          logoUrl: this.logoOverlay ? (this.orgLogo || undefined) : undefined,
          eventTemplateId: this.selectedEventTemplateId || undefined,
          includePeople: this.includePeople === true,
          peopleNationality: this.includePeople === true ? (this.peopleNationality.trim() || undefined) : undefined
        }
      ).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success && res.imageUrl) this.variants[idx].imageUrl = res.imageUrl;
          this.variants[idx].savedToLibrary = res.savedToLibrary ?? false;
          if (res.designDna) this.variants[idx].designDna = res.designDna;
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
    this.variants[idx].savedToLibrary = false;
    const apiGenerationMode = this.generationMode === 'template' ? 'reference' : this.generationMode;
    this.http.post<{ success: boolean; imageUrl: string; savedToLibrary?: boolean; designDna?: DesignDna }>(
      `${environment.apiUrl}/posts/generate-variant-image`,
      {
        topic: this.topic.trim() || (this.selectedEventTemplate?.name ?? ''),
        variantContent: this.variants[idx].content,
        imageConfig: this.imageConfig, variantIndex: idx,
        contentType: this.contentType,
        generationMode: apiGenerationMode,
        logoOverlay: this.logoOverlay && !!this.orgLogo,
        logoPosition: this.logoPosition,
        logoUrl: this.logoOverlay ? (this.orgLogo || undefined) : undefined,
        eventTemplateId: this.selectedEventTemplateId || undefined,
        includePeople: this.includePeople === true,
        peopleNationality: this.includePeople === true ? (this.peopleNationality.trim() || undefined) : undefined
      }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.imageUrl) {
          this.variants[idx].imageUrl = res.imageUrl;
          if (this.selectedImageIndex === null) this.selectedImageIndex = idx;
        }
        this.variants[idx].savedToLibrary = res.savedToLibrary ?? false;
        if (res.designDna) this.variants[idx].designDna = res.designDna;
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

  // ─── Video Generation ───────────────────────────────────────────────────────

  fetchVideosForVariants(): void {
    this.generatingVideos = true;
    const topic = this.topic.trim();
    this.variants.forEach(v => { v.loadingVideo = true; v.videoError = null; v.videoProgress = 0; });

    this.variants.forEach((_v, idx) => {
      this.submitVideoJob(topic, idx);
    });
  }

  /** Generate a video for a single variant on demand */
  generateVideoForVariant(idx: number): void {
    if (this.variants[idx]?.loadingVideo) return;
    this.variants[idx].loadingVideo = true;
    this.variants[idx].videoError = null;
    this.variants[idx].videoProgress = 0;
    this.submitVideoJob(this.topic.trim(), idx);
  }

  /** Submit a video job and start polling for its status */
  private submitVideoJob(topic: string, idx: number): void {
    this.http.post<{ success: boolean; jobId: string }>(
      `${environment.apiUrl}/posts/generate-variant-video`,
      { topic, variantContent: this.variants[idx].content, videoConfig: this.videoConfig, variantIndex: idx }
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.jobId) {
          this.variants[idx].videoJobId = res.jobId;
          this.startVideoPolling(idx, res.jobId);
        } else {
          this.variants[idx].loadingVideo = false;
          this.variants[idx].videoError = { code: 'VIDEO_FAILED', message: 'Could not start video generation.' };
          this.checkAllVideosComplete();
        }
      },
      error: (err) => {
        this.variants[idx].loadingVideo = false;
        this.variants[idx].videoError = this.parseVideoError(err);
        this.checkAllVideosComplete();
      }
    });
  }

  /** Poll GET /video-job/:jobId every 4 s until completed or failed */
  private startVideoPolling(idx: number, jobId: string): void {
    this.videoPolls.get(idx)?.unsubscribe();

    type VideoJobRes = {
      success: boolean;
      status: string;
      videoUrl: string | null;
      error: { code: string; message: string } | null;
    };

    const pollSub = timer(0, 4000)
      .pipe(
        switchMap(() =>
          this.http
            .get<VideoJobRes>(`${environment.apiUrl}/posts/video-job/${jobId}`)
            .pipe(catchError(() => of(null as VideoJobRes | null)))
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        if (res == null || !res.success) return;

        if (res.status === 'completed' && res.videoUrl) {
          pollSub.unsubscribe();
          this.videoPolls.delete(idx);
          this.variants[idx].videoUrl = res.videoUrl;
          this.variants[idx].loadingVideo = false;
          this.variants[idx].videoProgress = 100;
          if (this.selectedVideoIndex === null) this.selectedVideoIndex = idx;
          this.checkAllVideosComplete();
          this.loadCredits();
        } else if (res.status === 'failed') {
          pollSub.unsubscribe();
          this.videoPolls.delete(idx);
          this.variants[idx].loadingVideo = false;
          this.variants[idx].videoError = res.error || { code: 'VIDEO_FAILED', message: 'Video generation failed.' };
          this.checkAllVideosComplete();
        }
      });

    this.videoPolls.set(idx, pollSub);
  }

  private checkAllVideosComplete(): void {
    const allDone = this.variants.every(v => !v.loadingVideo);
    if (allDone) this.generatingVideos = false;
  }

  selectVideo(idx: number): void {
    this.selectedVideoIndex = this.selectedVideoIndex === idx ? null : idx;
  }

  randomizeVideoConfig(): void {
    const pickStyle = () => this.videoStyleOptions[Math.floor(Math.random() * this.videoStyleOptions.length)].id;
    const pickTone  = () => this.videoToneOptions[Math.floor(Math.random() * this.videoToneOptions.length)];
    const pickAspect = () => this.videoAspectOptions[Math.floor(Math.random() * this.videoAspectOptions.length)].id as '16:9' | '9:16';
    const pickDuration = () => this.videoDurations[Math.floor(Math.random() * this.videoDurations.length)] as 4 | 8 | 12;
    this.videoConfig = { duration: pickDuration(), aspect: pickAspect(), style: pickStyle(), tone: pickTone() };
  }

  clearVideoConfig(): void {
    this.videoConfig = { duration: 4, aspect: '9:16', style: 'cinematic', tone: 'energetic' };
  }

  get hasVideoConfig(): boolean {
    return this.videoConfig.style !== 'cinematic' || this.videoConfig.tone !== 'energetic' ||
           this.videoConfig.duration !== 4 || this.videoConfig.aspect !== '9:16';
  }

  get selectedVideoUrl(): string | undefined {
    return this.selectedVideoIndex !== null ? this.variants[this.selectedVideoIndex]?.videoUrl : undefined;
  }

  /** Post-type options driven by which platforms are selected */
  get videoPostTypeOptions(): { id: string; label: string; icon: string; platforms: string[] }[] {
    const ids = this.selectedPlatformIds.map(p => p.toLowerCase());
    const opts: { id: string; label: string; icon: string; platforms: string[] }[] = [];

    const hasInstagram  = ids.includes('instagram');
    const hasFacebook   = ids.includes('facebook');
    const hasYouTube    = ids.includes('youtube');
    const hasLinkedIn   = ids.includes('linkedin');

    if (hasInstagram || hasFacebook) {
      opts.push({ id: 'reel',  label: 'Reel',  icon: 'fa-film',         platforms: ['Instagram', 'Facebook'] });
      opts.push({ id: 'story', label: 'Story', icon: 'fa-circle-dot',   platforms: ['Instagram', 'Facebook'] });
      opts.push({ id: 'post',  label: 'Feed Post', icon: 'fa-image',    platforms: ['Instagram', 'Facebook'] });
    }
    if (hasYouTube) {
      opts.push({ id: 'video', label: 'YouTube Video', icon: 'fa-youtube',   platforms: ['YouTube'] });
      opts.push({ id: 'short', label: 'YouTube Short', icon: 'fa-bolt',      platforms: ['YouTube'] });
    }
    if (hasLinkedIn && !hasInstagram && !hasFacebook && !hasYouTube) {
      opts.push({ id: 'post',  label: 'Video Post', icon: 'fa-linkedin', platforms: ['LinkedIn'] });
    }
    return opts.length ? opts : [{ id: 'reel', label: 'Reel', icon: 'fa-film', platforms: [] }];
  }

  /** Normalise an HTTP error into a typed videoError object */
  private parseVideoError(err: any): { code: string; message: string } {
    const body = err?.error;
    const code = body?.code || 'VIDEO_FAILED';
    const message = body?.message || 'Could not generate video for this variant. Please try again.';
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
    const postType = this.selectedVideoUrl ? this.videoPostType : this.postFormat;
    const scheduleDesignDna = this.selectedImageIndex !== null
      ? (this.variants[this.selectedImageIndex]?.designDna ?? null)
      : null;
    const body: any = { platform, content, scheduledFor, postType, generatedBy: 'ai' };
    if (this.selectedVideoUrl) body.mediaUrl = this.selectedVideoUrl;
    else if (this.selectedImageUrl) body.mediaUrl = this.selectedImageUrl;
    if (scheduleDesignDna) body.designDna = scheduleDesignDna;
    this.http.post<any>(`${environment.apiUrl}/posts/schedule`, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.showScheduleModal = false; this.scheduleDate = ''; this.scheduleTime = '';
          this.scheduling = false;
          if (res?.pendingApproval) {
            this.notify.success('Submitted for Approval', 'Your post has been sent to the admin for review.');
          } else {
            this.notify.success('Scheduled', 'Post scheduled successfully.');
          }
        },
        error: (err) => { this.scheduling = false; this.notify.error('Schedule Failed', err?.error?.message || 'Failed to schedule.'); }
      });
  }

  publishNow(): void {
    const content = this.selectedContent;
    if (!content || !this.selectedPlatformIds.length) return;
    this.publishing = true;
    const postType = this.selectedVideoUrl ? this.videoPostType : this.postFormat;
    const publishDesignDna = this.selectedImageIndex !== null
      ? (this.variants[this.selectedImageIndex]?.designDna ?? null)
      : null;
    const calls = this.selectedPlatformIds.map(platformId => {
      const body: any = { platform: platformId, content, postType, generatedBy: 'ai' };
      if (this.selectedVideoUrl) body.mediaUrl = this.selectedVideoUrl;
      else if (this.selectedImageUrl) body.mediaUrl = this.selectedImageUrl;
      if (publishDesignDna) body.designDna = publishDesignDna;
      return this.http.post<any>(`${environment.apiUrl}/posts/publish`, body);
    });
    forkJoin(calls).pipe(takeUntil(this.destroy$)).subscribe({
      next: (results) => {
        this.publishing = false;
        const sentForApproval = results.some((r: any) => r?.pendingApproval);
        if (sentForApproval) {
          this.notify.success('Submitted for Approval', 'Your post has been sent to the admin for review.');
        } else {
          this.notify.success('Published', 'Post published successfully.');
        }
      },
      error: (err) => {
        this.publishing = false;
        const body = err?.error;
        if (body?.code === 'PLATFORM_NOT_CONNECTED' && body?.platform === 'youtube') {
          this.notify.error('YouTube Not Connected', body.message);
        } else if (body?.code === 'PLATFORM_NOT_IMPLEMENTED' && body?.platform === 'youtube') {
          this.notify.info('YouTube — Download & Upload', body.message);
        } else {
          this.notify.error('Publish Failed', body?.message || 'Failed to publish.');
        }
      }
    });
  }

  // ─── Event Templates ─────────────────────────────────────────────────────
  eventTemplates: EventTemplateItem[] = [];
  eventTemplatesLoading = false;
  showEventPanel = false;
  selectedEventTemplateId: string | null = null;
  newEventName = '';
  newEventType = 'custom';
  eventTypeOptions = EVENT_TYPE_OPTIONS;
  eventCreating = false;

  loadEventTemplates(): void {
    this.eventTemplatesLoading = true;
    this.http.get<any>(`${environment.apiUrl}/event-templates`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.eventTemplates = res.data || [];
          this.eventTemplatesLoading = false;
        },
        error: () => { this.eventTemplatesLoading = false; }
      });
  }

  createEventTemplate(fileInput: HTMLInputElement): void {
    if (!this.newEventName.trim()) return;
    const file = fileInput.files?.[0];
    const fd = new FormData();
    fd.append('name', this.newEventName.trim());
    fd.append('eventType', this.newEventType);
    if (file) fd.append('referenceImage', file);
    this.eventCreating = true;
    this.http.post<any>(`${environment.apiUrl}/event-templates`, fd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eventCreating = false;
          this.newEventName = '';
          fileInput.value = '';
          this.loadEventTemplates();
        },
        error: () => { this.eventCreating = false; }
      });
  }

  deleteEventTemplate(id: string): void {
    this.http.delete<any>(`${environment.apiUrl}/event-templates/${id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.loadEventTemplates() });
  }

  selectEventTemplate(id: string): void {
    this.selectedEventTemplateId = this.selectedEventTemplateId === id ? null : id;
  }

  get selectedEventTemplate(): EventTemplateItem | null {
    return this.eventTemplates.find(t => t._id === this.selectedEventTemplateId) || null;
  }

  getEventIcon(eventType: string): string {
    return this.eventTypeOptions.find(o => o.id === eventType)?.icon || 'fa-calendar';
  }

  // ─── Post Editor ─────────────────────────────────────────────────────────
  showPostEditor = false;
  editorBackgroundUrl: string | null = null;
  editorLogoUrl: string | null = null;
  editorHeadline = '';
  editorBrandColors: string[] = [];
  uploadingEditorImage = false;

  openPostEditor(variantIdx: number): void {
    const v = this.variants[variantIdx];
    if (!v?.imageUrl) return;
    this.editorBackgroundUrl = `${environment.apiUrl}/media-library/proxy?url=${encodeURIComponent(v.imageUrl)}`;
    this.editorLogoUrl = this.orgLogo
      ? `${environment.apiUrl}/media-library/proxy?url=${encodeURIComponent(this.orgLogo)}`
      : null;
    this.editorHeadline = (v.content || '').split('\n')[0]?.slice(0, 60) || '';
    this.showPostEditor = true;
  }

  onEditorDone(output: PostEditorOutput): void {
    this.showPostEditor = false;
    this.uploadingEditorImage = true;

    const blob = this.dataUrlToBlob(output.dataUrl);
    const fd = new FormData();
    fd.append('media', blob, `edited-post-${Date.now()}.png`);

    this.http.post<any>(`${environment.apiUrl}/media-library/upload`, fd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.uploadingEditorImage = false;
          if (res.success && res.data?.publicUrl) {
            const idx = this.selectedTextIndex;
            if (this.variants[idx]) {
              this.variants[idx].imageUrl = res.data.publicUrl;
              this.variants[idx].savedToLibrary = true;
            }
            this.selectedImageIndex = idx;
            this.notify.success('Image Saved', 'Edited image saved to media library.');
          }
        },
        error: () => {
          this.uploadingEditorImage = false;
          this.notify.error('Upload Failed', 'Could not save edited image.');
        }
      });
  }

  onEditorCancel(): void {
    this.showPostEditor = false;
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const raw = atob(parts[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ─── Draft State ──────────────────────────────────────────────────────────
  savingDraft = false;
  draftSaved = false;
  draftId = '';
  savingAllDrafts = false;
  allDraftsSaved = false;
  allDraftsSavedCount = 0;

  saveDraft(): void {
    if (this.savingDraft) return;
    const platform = this.selectedPlatformIds[0];
    if (!platform) { this.notify.error('No Platform', 'Please select a platform first.'); return; }

    const content = this.editedContent || this.variants[this.selectedTextIndex]?.content;
    if (!content) { this.notify.error('No Content', 'Please generate content first.'); return; }

    const selectedVariant = this.variants[this.selectedTextIndex];
    const imageUrl = this.selectedImageIndex !== null ? this.variants[this.selectedImageIndex]?.imageUrl : undefined;
    const videoUrl = this.selectedVideoIndex !== null ? this.variants[this.selectedVideoIndex]?.videoUrl : undefined;
    const selectedDesignDna = this.selectedImageIndex !== null
      ? (this.variants[this.selectedImageIndex]?.designDna ?? null)
      : null;

    this.savingDraft = true;
    const body: any = {
      platform,
      content,
      postType: this.postFormat,
      generatedBy: 'ai',
      topic: this.topic,
      audience: this.audience,
      intent: this.intent,
      contentType: this.contentType,
      postFormat: this.postFormat,
      logoOverlay: this.logoOverlay,
      logoPosition: this.logoPosition,
      ...(selectedDesignDna ? { designDna: selectedDesignDna } : {})
    };

    if (videoUrl) body.mediaUrl = videoUrl;
    else if (imageUrl) body.mediaUrl = imageUrl;
    else if (selectedVariant?.videoUrl) body.mediaUrl = selectedVariant.videoUrl;
    else if (selectedVariant?.imageUrl) body.mediaUrl = selectedVariant.imageUrl;

    this.http.post<any>(`${environment.apiUrl}/posts/save-draft`, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.savingDraft = false;
          this.draftSaved = true;
          this.draftId = res.draft?._id ?? '';
          this.notify.success('Draft Saved', 'Post saved as draft. You can resume from the Drafts page.');
        },
        error: (err) => {
          this.savingDraft = false;
          this.notify.error('Draft Failed', err?.error?.message || 'Could not save draft.');
        }
      });
  }

  saveAllDrafts(): void {
    if (this.savingAllDrafts || !this.variants.length) return;
    const platform = this.selectedPlatformIds[0];
    if (!platform) { this.notify.error('No Platform', 'Please select a platform first.'); return; }

    this.savingAllDrafts = true;
    this.allDraftsSaved = false;
    this.allDraftsSavedCount = 0;

    const commonMeta = {
      postType: this.postFormat,
      generatedBy: 'ai',
      topic: this.topic,
      audience: this.audience,
      intent: this.intent,
      contentType: this.contentType,
      postFormat: this.postFormat,
      logoOverlay: this.logoOverlay,
      logoPosition: this.logoPosition
    };

    const calls = this.variants.map(v => {
      const body: any = { platform, content: v.content, ...commonMeta };
      if (v.videoUrl) body.mediaUrl = v.videoUrl;
      else if (v.imageUrl) body.mediaUrl = v.imageUrl;
      if (v.designDna) body.designDna = v.designDna;
      return this.http.post<any>(`${environment.apiUrl}/posts/save-draft`, body);
    });

    forkJoin(calls).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingAllDrafts = false;
        this.allDraftsSaved = true;
        this.allDraftsSavedCount = this.variants.length;
        this.notify.success(
          'All Variants Saved',
          `${this.variants.length} draft${this.variants.length > 1 ? 's' : ''} saved. View them on the Drafts page.`
        );
      },
      error: (err) => {
        this.savingAllDrafts = false;
        this.notify.error('Draft Failed', err?.error?.message || 'Could not save all drafts.');
      }
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
