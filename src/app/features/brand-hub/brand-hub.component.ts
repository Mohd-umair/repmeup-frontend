import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrandConfigService, IBrandConfig } from '../../core/services/brand-config.service';
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

  constructor(private brandConfig: BrandConfigService) {}

  ngOnInit(): void {
    this.load();
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
}
