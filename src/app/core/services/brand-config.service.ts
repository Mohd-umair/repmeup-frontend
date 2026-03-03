import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IBrandConfig {
  _id?: string;
  organization?: string;
  toneOfVoice: string;
  personalityTags: string[];
  bannedWords: string[];
  approvedHashtags: string[];
  legalDisclaimers: string;
  voiceLastTrainedAt?: string | null;
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
}
