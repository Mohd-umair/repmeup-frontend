import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IBrandHashtagStrategy {
  avgCount: number;
  branded: string[];
  generic: string[];
}

export interface IBrandProfile {
  writingStyle: string;
  emojiUsage: 'heavy' | 'moderate' | 'minimal' | 'none';
  recurringEmojis: string[];
  hashtagStrategy: IBrandHashtagStrategy;
  ctaStyle: string[];
  personalityDescriptors: string[];
  colorPalette: string[];
  visualComposition: string;
  typographyStyle: string;
  logoPlacement: string;
  imageMood: string;
  analyzedPostCount: number;
  analyzedAt: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface IBrandConfig {
  _id?: string;
  organization?: string;
  toneOfVoice: string;
  personalityTags: string[];
  bannedWords: string[];
  approvedHashtags: string[];
  legalDisclaimers: string;
  voiceLastTrainedAt?: string | null;
  brandProfile?: IBrandProfile;
  brandProfileOverrides?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class BrandConfigService {
  private base = `${environment.apiUrl}/brand-config`;

  constructor(private http: HttpClient) {}

  get(): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.get<{ success: boolean; data: IBrandConfig }>(this.base);
  }

  update(body: Partial<IBrandConfig>): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.put<{ success: boolean; data: IBrandConfig }>(this.base, body);
  }

  retrain(): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.post<{ success: boolean; data: IBrandConfig }>(`${this.base}/retrain`, {});
  }

  getPreview(): Observable<{ success: boolean; data: { preview: string } }> {
    return this.http.post<{ success: boolean; data: { preview: string } }>(`${this.base}/preview`, {});
  }

  analyzeBrandProfile(): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.post<{ success: boolean; data: IBrandConfig }>(`${this.base}/analyze`, {});
  }

  updateProfileOverrides(overrides: Record<string, unknown> | null): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.put<{ success: boolean; data: IBrandConfig }>(`${this.base}/profile-overrides`, { overrides });
  }

  clearBrandProfile(): Observable<{ success: boolean; data: IBrandConfig }> {
    return this.http.delete<{ success: boolean; data: IBrandConfig }>(`${this.base}/brand-profile`);
  }

  // Reference images
  listReferenceImages(): Observable<{ success: boolean; data: IBrandReferenceImage[]; total: number; max: number }> {
    return this.http.get<{ success: boolean; data: IBrandReferenceImage[]; total: number; max: number }>(`${this.base}/reference-images`);
  }

  uploadReferenceImages(files: File[], category?: string): Observable<{ success: boolean; data: IBrandReferenceImage[] }> {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    if (category) fd.append('category', category);
    return this.http.post<{ success: boolean; data: IBrandReferenceImage[] }>(`${this.base}/reference-images`, fd);
  }

  updateReferenceImage(id: string, body: Partial<IBrandReferenceImage>): Observable<{ success: boolean; data: IBrandReferenceImage }> {
    return this.http.put<{ success: boolean; data: IBrandReferenceImage }>(`${this.base}/reference-images/${id}`, body);
  }

  deleteReferenceImage(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/reference-images/${id}`);
  }

  getStyleSummary(): Observable<{ success: boolean; data: IVisualStyleSummary | null; analyzedCount?: number }> {
    return this.http.get<{ success: boolean; data: IVisualStyleSummary | null; analyzedCount?: number }>(`${this.base}/reference-images/style-summary`);
  }
}

export interface IBrandReferenceImage {
  _id: string;
  organization: string;
  imageUrl: string;
  s3Key?: string;
  category: string;
  tags: string[];
  analysis?: {
    dominantColors?: string[];
    compositionType?: string;
    textDensity?: string;
    typographyStyle?: string;
    logoPosition?: string;
    mood?: string;
    layoutPattern?: string;
  } | null;
  sortOrder: number;
  createdAt?: string;
}

export interface IVisualStyleSummary {
  colorPalette: string[];
  composition: string;
  mood: string;
  layout: string;
  textDensity: string;
}
