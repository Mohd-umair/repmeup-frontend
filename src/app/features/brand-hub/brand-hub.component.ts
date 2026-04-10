import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrandConfigService, IBrandConfig, IBrandProfile, IBrandReferenceImage, IVisualStyleSummary } from '../../core/services/brand-config.service';
import { ButtonComponent } from '../../shared/components/button/button.component';

const TONE_OPTIONS = [
  'professional',
  'casual',
  'friendly',
  'authoritative',
  'playful',
  'inspirational',
  'neutral'
];

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
  activeTab: 'settings' | 'profile' | 'references' = 'settings';

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

  constructor(private brandConfig: BrandConfigService) {}

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
          this.loadPreview();
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
          this.loadPreview();
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
}
