import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BrandConfigService, IBrandConfig, IBrandProfile, IBrandReferenceImage, IVisualStyleSummary } from '../../core/services/brand-config.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { environment } from '../../../environments/environment';

const TONE_OPTIONS = [
  'professional',
  'casual',
  'friendly',
  'authoritative',
  'playful',
  'inspirational',
  'neutral'
];

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

export interface IOccasionTemplate {
  _id: string;
  name: string;
  eventType: string;
  referenceImageUrl: string | null;
  sampleCaption: string;
  hashtags: string[];
  cta: string;
  eventStyle: {
    dominantColors?: string[];
    decorativeElements?: string[];
    typography?: string;
    layoutPattern?: string;
    mood?: string;
  } | null;
  isActive: boolean;
  createdAt: string;
}

export interface IInspirationImage {
  _id: string;
  industry: string;
  imageUrl: string;
  tags: string[];
  sortOrder: number;
}

export const INDUSTRY_OPTIONS = [
  { id: 'fashion', label: 'Fashion' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'real_estate', label: 'Real Estate' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'saas', label: 'SaaS' },
  { id: 'retail', label: 'Retail' },
  { id: 'education', label: 'Education' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'beauty', label: 'Beauty' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'finance', label: 'Finance' },
  { id: 'automotive', label: 'Automotive' },
  { id: 'other', label: 'Other' }
];

/** Organization settings (Settings → Organization) uses different option values — map to inspiration API keys */
const ORG_INDUSTRY_TO_INSPIRATION: Record<string, string> = {
  technology: 'saas',
  retail: 'retail',
  healthcare: 'clinic',
  finance: 'finance',
  education: 'education',
  hospitality: 'hospitality',
  'real-estate': 'real_estate',
  real_estate: 'real_estate',
  automotive: 'automotive',
  food: 'restaurant',
  entertainment: 'other',
  other: 'other'
};

const INSPIRATION_ID_SET = new Set(INDUSTRY_OPTIONS.map((o) => o.id));

function mapOrgIndustryToInspirationKey(raw: string | undefined | null): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const normalized = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  if (INSPIRATION_ID_SET.has(normalized)) return normalized;
  const mapped = ORG_INDUSTRY_TO_INSPIRATION[normalized];
  if (mapped && INSPIRATION_ID_SET.has(mapped)) return mapped;
  return null;
}

@Component({
  selector: 'app-brand-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ButtonComponent],
  templateUrl: './brand-hub.component.html',
  styleUrls: ['./brand-hub.component.scss']
})
export class BrandHubComponent implements OnInit {
  config: IBrandConfig | null = null;
  loading = true;
  saving = false;
  preview = '';
  loadingPreview = false;
  retraining = false;
  showRetrainBanner = false;
  toneOptions = TONE_OPTIONS;

  personalityInput = '';
  bannedInput = '';
  hashtagInput = '';

  analyzing = false;
  analyzeError = '';
  activeTab: 'settings' | 'profile' | 'references' | 'occasions' = 'settings';
  eventTypeOptions = EVENT_TYPE_OPTIONS;

  // Edit profile state
  editingProfile = false;
  editProfile: any = {};
  savingProfile = false;
  clearingProfile = false;
  confirmClear = false;

  refImages: IBrandReferenceImage[] = [];
  refTotal = 0;
  refMax = 20;
  refLoading = false;
  refUploading = false;
  styleSummary: IVisualStyleSummary | null = null;

  // ─── Occasions ───────────────────────────────────────────
  occasionTemplates: IOccasionTemplate[] = [];
  loadingOccasions = false;
  savingOccasion = false;
  deletingOccasionId: string | null = null;
  selectedOccasion: IOccasionTemplate | null = null;
  showOccasionPanel = false;
  occasionDraft: Partial<IOccasionTemplate> & { hashtagsInput?: string } = {};
  occasionDraftFile: File | null = null;
  occasionDraftPreview: string | null = null;
  occasionPanelMode: 'create' | 'edit' = 'create';
  private _occasionsLoaded = false;

  // ─── Inspiration Library ──────────────────────────────────
  refSubTab: 'my-uploads' | 'inspiration' = 'my-uploads';
  inspirations: IInspirationImage[] = [];
  inspirationIndustry = '';
  selectedInspirationIds = new Set<string>();
  addingInspirations = false;
  loadingInspirations = false;
  inspirationSuccess = '';
  /** True when the current filter came from Organization settings industry (user can still change) */
  inspirationIndustryFromOrg = false;
  private _inspirationPanelBootstrapped = false;

  readonly INDUSTRY_OPTIONS = INDUSTRY_OPTIONS;
  /** Dropdown: industries + browse all */
  readonly inspirationFilterOptions = [
    ...INDUSTRY_OPTIONS,
    { id: 'all', label: 'All industries' }
  ];

  constructor(private brandConfig: BrandConfigService, private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  get profile(): IBrandProfile | null {
    return this.config?.brandProfile?.analyzedAt ? this.config.brandProfile : null;
  }

  load(): void {
    this.loading = true;
    this.brandConfig.get().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.config = res.data;
          this.checkRetrainBanner();
          // Preview is on-demand only — do NOT auto-call here (costs 1 AI credit per page load)
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  checkRetrainBanner(): void {
    if (!this.config) return;
    const updated = this.config.updatedAt ? new Date(this.config.updatedAt).getTime() : 0;
    const trained = this.config.voiceLastTrainedAt ? new Date(this.config.voiceLastTrainedAt).getTime() : 0;
    this.showRetrainBanner = trained === 0 ? updated > 0 : updated > trained;
  }

  loadPreview(): void {
    this.loadingPreview = true;
    this.preview = '';
    this.brandConfig.getPreview().subscribe({
      next: (res) => {
        if (res.success && res.data?.preview) {
          this.preview = res.data.preview;
        }
        this.loadingPreview = false;
      },
      error: () => {
        this.loadingPreview = false;
      }
    });
  }

  save(): void {
    if (!this.config) return;
    this.saving = true;
    this.brandConfig.update({
      toneOfVoice: this.config.toneOfVoice,
      personalityTags: this.config.personalityTags || [],
      bannedWords: this.config.bannedWords || [],
      approvedHashtags: this.config.approvedHashtags || [],
      legalDisclaimers: this.config.legalDisclaimers || ''
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.config = res.data;
          this.checkRetrainBanner();
        }
        this.saving = false;
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  retrain(): void {
    this.retraining = true;
    this.brandConfig.retrain().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.config = res.data;
          this.showRetrainBanner = false;
          // Don't auto-generate preview — user must click manually
          this.preview = '';
        }
        this.retraining = false;
      },
      error: () => {
        this.retraining = false;
      }
    });
  }

  analyzeBrand(): void {
    this.analyzing = true;
    this.analyzeError = '';
    this.brandConfig.analyzeBrandProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.config = res.data;
          this.activeTab = 'profile';
        }
        this.analyzing = false;
      },
      error: (err) => {
        this.analyzeError = err?.error?.error || 'Analysis failed. Please try again.';
        this.analyzing = false;
      }
    });
  }

  addPersonality(): void {
    const v = this.personalityInput.trim();
    if (!v || !this.config) return;
    this.config.personalityTags = this.config.personalityTags || [];
    if (!this.config.personalityTags.includes(v)) {
      this.config.personalityTags = [...this.config.personalityTags, v];
    }
    this.personalityInput = '';
  }

  removePersonality(tag: string): void {
    if (!this.config?.personalityTags) return;
    this.config.personalityTags = this.config.personalityTags.filter(t => t !== tag);
  }

  addBanned(): void {
    const v = this.bannedInput.trim().toLowerCase();
    if (!v || !this.config) return;
    this.config.bannedWords = this.config.bannedWords || [];
    if (!this.config.bannedWords.includes(v)) {
      this.config.bannedWords = [...this.config.bannedWords, v];
    }
    this.bannedInput = '';
  }

  removeBanned(word: string): void {
    if (!this.config?.bannedWords) return;
    this.config.bannedWords = this.config.bannedWords.filter(w => w !== word);
  }

  addHashtag(): void {
    let v = this.hashtagInput.trim();
    if (!v || !this.config) return;
    if (!v.startsWith('#')) v = '#' + v;
    this.config.approvedHashtags = this.config.approvedHashtags || [];
    if (!this.config.approvedHashtags.includes(v)) {
      this.config.approvedHashtags = [...this.config.approvedHashtags, v];
    }
    this.hashtagInput = '';
  }

  removeHashtag(tag: string): void {
    if (!this.config?.approvedHashtags) return;
    this.config.approvedHashtags = this.config.approvedHashtags.filter(t => t !== tag);
  }

  // ─── Reference Images ────────────────────────
  loadRefImages(): void {
    this.refLoading = true;
    this.brandConfig.listReferenceImages().subscribe({
      next: (res) => {
        this.refImages = res.data || [];
        this.refTotal = res.total || 0;
        this.refMax = res.max || 20;
        this.refLoading = false;
        this.loadStyleSummary();
      },
      error: () => { this.refLoading = false; }
    });
  }

  loadStyleSummary(): void {
    this.brandConfig.getStyleSummary().subscribe({
      next: (res) => { this.styleSummary = res.data; },
      error: () => {}
    });
  }

  onRefFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const files = Array.from(input.files).slice(0, 5);
    this.refUploading = true;
    this.brandConfig.uploadReferenceImages(files).subscribe({
      next: () => {
        this.refUploading = false;
        this.loadRefImages();
        input.value = '';
      },
      error: () => { this.refUploading = false; }
    });
  }

  deleteRefImage(id: string): void {
    this.brandConfig.deleteReferenceImage(id).subscribe({
      next: () => { this.loadRefImages(); },
      error: () => {}
    });
  }

  onRefTabActivated(): void {
    if (!this.refImages.length && !this.refLoading) {
      this.loadRefImages();
    }
  }

  // ─── Brand Profile Edit / Delete ─────────────────
  startEditProfile(): void {
    if (!this.profile) return;
    // Deep copy profile fields into editable draft
    this.editProfile = {
      writingStyle: this.profile.writingStyle || '',
      emojiUsage: this.profile.emojiUsage || 'moderate',
      recurringEmojis: (this.profile.recurringEmojis || []).join(', '),
      ctaStyle: (this.profile.ctaStyle || []).join(', '),
      personalityDescriptors: (this.profile.personalityDescriptors || []).join(', '),
      colorPalette: (this.profile.colorPalette || []).join(', '),
      visualComposition: this.profile.visualComposition || '',
      typographyStyle: this.profile.typographyStyle || '',
      logoPlacement: this.profile.logoPlacement || '',
      imageMood: this.profile.imageMood || ''
    };
    this.editingProfile = true;
  }

  cancelEditProfile(): void {
    this.editingProfile = false;
    this.editProfile = {};
  }

  saveProfileEdits(): void {
    this.savingProfile = true;
    const toArr = (s: string) => s.split(',').map((x: string) => x.trim()).filter(Boolean);
    const overrides: Record<string, unknown> = {
      writingStyle: this.editProfile.writingStyle,
      emojiUsage: this.editProfile.emojiUsage,
      recurringEmojis: toArr(this.editProfile.recurringEmojis),
      ctaStyle: toArr(this.editProfile.ctaStyle),
      personalityDescriptors: toArr(this.editProfile.personalityDescriptors),
      colorPalette: toArr(this.editProfile.colorPalette),
      visualComposition: this.editProfile.visualComposition,
      typographyStyle: this.editProfile.typographyStyle,
      logoPlacement: this.editProfile.logoPlacement,
      imageMood: this.editProfile.imageMood
    };
    this.brandConfig.updateProfileOverrides(overrides).subscribe({
      next: (res) => {
        if (res.success && res.data) this.config = res.data;
        this.savingProfile = false;
        this.editingProfile = false;
      },
      error: () => { this.savingProfile = false; }
    });
  }

  clearBrandProfile(): void {
    this.clearingProfile = true;
    this.confirmClear = false;
    this.brandConfig.clearBrandProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) this.config = res.data;
        this.clearingProfile = false;
      },
      error: () => { this.clearingProfile = false; }
    });
  }

  // ─── Occasion Templates ──────────────────────────────────
  onOccasionTabActivated(): void {
    if (!this._occasionsLoaded) {
      this.loadOccasions();
    }
  }

  loadOccasions(): void {
    this.loadingOccasions = true;
    this.http.get<{ success: boolean; data: IOccasionTemplate[] }>(`${environment.apiUrl}/event-templates`).subscribe({
      next: (res) => {
        this.occasionTemplates = res.data || [];
        this.loadingOccasions = false;
        this._occasionsLoaded = true;
      },
      error: () => { this.loadingOccasions = false; }
    });
  }

  openCreateOccasion(): void {
    this.occasionPanelMode = 'create';
    this.occasionDraft = { eventType: 'custom', name: '', sampleCaption: '', cta: '', hashtags: [], hashtagsInput: '' };
    this.occasionDraftFile = null;
    this.occasionDraftPreview = null;
    this.selectedOccasion = null;
    this.showOccasionPanel = true;
  }

  openEditOccasion(tpl: IOccasionTemplate): void {
    this.occasionPanelMode = 'edit';
    this.selectedOccasion = tpl;
    this.occasionDraft = {
      ...tpl,
      hashtagsInput: (tpl.hashtags || []).join(', ')
    };
    this.occasionDraftFile = null;
    this.occasionDraftPreview = null;
    this.showOccasionPanel = true;
  }

  closeOccasionPanel(): void {
    this.showOccasionPanel = false;
    this.selectedOccasion = null;
    this.occasionDraft = {};
    this.occasionDraftFile = null;
    this.occasionDraftPreview = null;
  }

  onOccasionImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.occasionDraftFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.occasionDraftPreview = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  saveOccasion(): void {
    if (!this.occasionDraft.name || !this.occasionDraft.eventType) return;
    this.savingOccasion = true;
    const hashtagsArr = (this.occasionDraft.hashtagsInput || '')
      .split(',').map(h => h.trim()).filter(Boolean);

    const fd = new FormData();
    fd.append('name', this.occasionDraft.name || '');
    fd.append('eventType', this.occasionDraft.eventType || 'custom');
    fd.append('sampleCaption', this.occasionDraft.sampleCaption || '');
    fd.append('hashtags', JSON.stringify(hashtagsArr));
    fd.append('cta', this.occasionDraft.cta || '');
    if (this.occasionDraftFile) fd.append('referenceImage', this.occasionDraftFile);

    if (this.occasionPanelMode === 'create') {
      this.http.post<{ success: boolean; data: IOccasionTemplate }>(`${environment.apiUrl}/event-templates`, fd).subscribe({
        next: (res) => {
          if (res.success) {
            this.occasionTemplates = [res.data, ...this.occasionTemplates];
            this.closeOccasionPanel();
          }
          this.savingOccasion = false;
        },
        error: () => { this.savingOccasion = false; }
      });
    } else if (this.selectedOccasion) {
      this.http.put<{ success: boolean; data: IOccasionTemplate }>(`${environment.apiUrl}/event-templates/${this.selectedOccasion._id}`, fd).subscribe({
        next: (res) => {
          if (res.success) {
            this.occasionTemplates = this.occasionTemplates.map(t => t._id === res.data._id ? res.data : t);
            this.closeOccasionPanel();
          }
          this.savingOccasion = false;
        },
        error: () => { this.savingOccasion = false; }
      });
    }
  }

  deleteOccasion(id: string): void {
    this.deletingOccasionId = id;
    this.http.delete<{ success: boolean }>(`${environment.apiUrl}/event-templates/${id}`).subscribe({
      next: () => {
        this.occasionTemplates = this.occasionTemplates.filter(t => t._id !== id);
        if (this.selectedOccasion?._id === id) this.closeOccasionPanel();
        this.deletingOccasionId = null;
      },
      error: () => { this.deletingOccasionId = null; }
    });
  }

  getEventTypeLabel(eventType: string): string {
    return EVENT_TYPE_OPTIONS.find(o => o.id === eventType)?.label || eventType;
  }

  getEventTypeIcon(eventType: string): string {
    return EVENT_TYPE_OPTIONS.find(o => o.id === eventType)?.icon || 'fa-calendar';
  }

  // ─── Inspiration Library ──────────────────────────────────
  switchRefSubTab(tab: 'my-uploads' | 'inspiration'): void {
    this.refSubTab = tab;
    if (tab === 'inspiration' && !this._inspirationPanelBootstrapped) {
      this._inspirationPanelBootstrapped = true;
      this._bootstrapInspirationPanel();
    }
  }

  /** First visit: load org industry → map to inspiration filter; if none, user must pick before grid loads */
  private _bootstrapInspirationPanel(): void {
    this.http.get<{ success: boolean; data: { industry?: string } }>(`${environment.apiUrl}/organizations/me`)
      .subscribe({
        next: (res) => {
          const mapped = mapOrgIndustryToInspirationKey(res.data?.industry);
          if (mapped) {
            this.inspirationIndustry = mapped;
            this.inspirationIndustryFromOrg = true;
            this.loadInspirations();
          } else {
            this.inspirationIndustry = '';
            this.inspirationIndustryFromOrg = false;
            this.inspirations = [];
            this.loadingInspirations = false;
          }
        },
        error: () => {
          this.inspirationIndustry = '';
          this.inspirationIndustryFromOrg = false;
          this.inspirations = [];
          this.loadingInspirations = false;
        }
      });
  }

  loadInspirations(): void {
    if (!this.inspirationIndustry) {
      this.inspirations = [];
      this.loadingInspirations = false;
      return;
    }
    this.loadingInspirations = true;
    const industry = this.inspirationIndustry;
    const url = `${environment.apiUrl}/inspirations?industry=${encodeURIComponent(industry)}`;
    this.http.get<{ success: boolean; data: IInspirationImage[] }>(url).subscribe({
      next: (res) => {
        this.inspirations = res.data || [];
        this.selectedInspirationIds.clear();
        this.selectedInspirationIds = new Set();
        this.loadingInspirations = false;
      },
      error: () => {
        this.loadingInspirations = false;
      }
    });
  }

  onInspirationIndustryChange(): void {
    if (!this.inspirationIndustry) {
      this.inspirationIndustryFromOrg = false;
      this.inspirations = [];
      this.selectedInspirationIds.clear();
      this.selectedInspirationIds = new Set();
      return;
    }
    this.inspirationIndustryFromOrg = false;
    this.loadInspirations();
  }

  getInspirationIndustryLabel(): string {
    if (!this.inspirationIndustry) return '';
    if (this.inspirationIndustry === 'all') return 'All industries';
    return INDUSTRY_OPTIONS.find((o) => o.id === this.inspirationIndustry)?.label || this.inspirationIndustry;
  }

  toggleInspiration(id: string): void {
    if (this.selectedInspirationIds.has(id)) {
      this.selectedInspirationIds.delete(id);
    } else {
      this.selectedInspirationIds.add(id);
    }
    // Trigger change detection for Set
    this.selectedInspirationIds = new Set(this.selectedInspirationIds);
  }

  addSelectedToReferences(): void {
    if (!this.selectedInspirationIds.size || this.addingInspirations) return;
    this.addingInspirations = true;
    this.inspirationSuccess = '';
    const imageIds = Array.from(this.selectedInspirationIds);
    this.http.post<{ success: boolean; added: number; message: string }>(
      `${environment.apiUrl}/inspirations/add-to-references`,
      { imageIds }
    ).subscribe({
      next: (res) => {
        this.addingInspirations = false;
        this.inspirationSuccess = res.message || `Added ${res.added} image(s) to your references.`;
        this.selectedInspirationIds.clear();
        this.selectedInspirationIds = new Set();
        this.loadRefImages();
        // Switch back to My Uploads tab after a short delay
        setTimeout(() => {
          this.refSubTab = 'my-uploads';
          this.inspirationSuccess = '';
        }, 2500);
      },
      error: (err) => {
        this.addingInspirations = false;
        const msg = err?.error?.error || 'Failed to add inspirations. Please try again.';
        alert(msg);
      }
    });
  }
}
