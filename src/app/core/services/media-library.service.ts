import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { 
  Media, 
  MediaLibraryParams, 
  MediaLibraryResponse, 
  MediaStatsResponse 
} from '../models/media.model';

/**
 * Media Library Service
 * Handles media library operations (upload, browse, delete)
 */
@Injectable({
  providedIn: 'root'
})
export class MediaLibraryService {
  private readonly endpoint = '/media-library';

  constructor(private api: ApiService) {}

  /**
   * Upload media to library
   */
  uploadMedia(file: File, tags: string[] = [], description: string = ''): Observable<{ success: boolean; message: string; data: Media }> {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('tags', JSON.stringify(tags));
    formData.append('description', description);

    return this.api.post<{ success: boolean; message: string; data: Media }>(
      `${this.endpoint}/upload`,
      formData
    );
  }

  /**
   * Get media library with filters
   */
  getMediaLibrary(params: MediaLibraryParams = {}): Observable<MediaLibraryResponse> {
    const queryParams: any = {
      page: params.page || 1,
      limit: params.limit || 20
    };

    if (params.mediaType) {
      queryParams.mediaType = params.mediaType;
    }

    if (params.tags && params.tags.length > 0) {
      queryParams.tags = params.tags.join(',');
    }

    if (params.sortBy) {
      queryParams.sortBy = params.sortBy;
    }

    return this.api.get<MediaLibraryResponse>(this.endpoint, queryParams);
  }

  /**
   * Get single media by ID
   */
  getMediaById(id: string): Observable<{ success: boolean; data: Media }> {
    return this.api.get<{ success: boolean; data: Media }>(`${this.endpoint}/${id}`);
  }

  /**
   * Update media metadata
   */
  updateMedia(id: string, data: { tags?: string[]; description?: string }): Observable<{ success: boolean; message: string; data: Media }> {
    return this.api.put<{ success: boolean; message: string; data: Media }>(
      `${this.endpoint}/${id}`,
      data
    );
  }

  /**
   * Delete media from library
   */
  deleteMedia(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`${this.endpoint}/${id}`);
  }

  /**
   * Get media library statistics
   */
  getStats(): Observable<MediaStatsResponse> {
    return this.api.get<MediaStatsResponse>(`${this.endpoint}/stats`);
  }

  /**
   * Format bytes to human-readable format
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
