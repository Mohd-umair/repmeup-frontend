import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Platform Service - Single Responsibility Principle
 * Handles platform connection management
 */

export interface PlatformConnection {
  _id: string;
  platform: string;
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformProfilePicture?: string;
  platformEmail?: string;
  platformData?: any;
  status: 'connected' | 'disconnected' | 'error';
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnectionResponse {
  success: boolean;
  data: PlatformConnection[];
}

export interface SinglePlatformConnectionResponse {
  success: boolean;
  data: PlatformConnection;
}

export interface AuthorizationUrlResponse {
  success: boolean;
  data: {
    authorizationUrl: string;
    state: string;
  };
}

export interface SyncResponse {
  success: boolean;
  message: string;
  data?: {
    interactionsAdded: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  constructor(private apiService: ApiService) {}

  /**
   * Get authorization URL for Google OAuth
   * @param type - 'reviews' for Google Business Profile or 'youtube' for YouTube
   */
  getGoogleAuthorizationUrl(type: 'reviews' | 'youtube' = 'reviews'): Observable<AuthorizationUrlResponse> {
    return this.apiService.get<AuthorizationUrlResponse>(`/platforms/google/connect`, { type });
  }

  /**
   * Get all platform connections for the current organization
   */
  getPlatformConnections(): Observable<PlatformConnectionResponse> {
    return this.apiService.get<PlatformConnectionResponse>('/platforms');
  }

  /**
   * Get a single platform connection
   */
  getPlatformConnection(id: string): Observable<SinglePlatformConnectionResponse> {
    return this.apiService.get<SinglePlatformConnectionResponse>(`/platforms/${id}`);
  }

  /**
   * Disconnect a platform
   */
  disconnectPlatform(id: string): Observable<{ success: boolean; message: string }> {
    return this.apiService.delete<{ success: boolean; message: string }>(`/platforms/${id}`);
  }

  /**
   * Manually sync platform data
   */
  syncPlatform(id: string): Observable<SyncResponse> {
    return this.apiService.post<SyncResponse>(`/platforms/${id}/sync`, {});
  }

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google authorization page
   */
  connectGoogle(type: 'reviews' | 'youtube' = 'reviews'): void {
    this.getGoogleAuthorizationUrl(type).subscribe({
      next: (response) => {
        if (response.success && response.data.authorizationUrl) {
          // Redirect to Google OAuth page
          window.location.href = response.data.authorizationUrl;
        }
      },
      error: (error) => {
        console.error('Error getting authorization URL:', error);
        alert('Failed to initiate Google connection. Please try again.');
      }
    });
  }

  /**
   * Initiate Instagram OAuth flow
   * Redirects user to Instagram/Meta authorization page
   */
  connectInstagram(): void {
    // Instagram uses Meta OAuth endpoint
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/instagram').subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          // Redirect to Instagram OAuth page
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Instagram authorization URL:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to initiate Instagram connection. Please try again.';
        alert(`Error: ${errorMessage}`);
      }
    });
  }

  /**
   * Initiate Facebook OAuth flow
   * Redirects user to Facebook/Meta authorization page
   */
  connectFacebook(): void {
    // Facebook uses Meta OAuth endpoint
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/facebook').subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          // Redirect to Facebook OAuth page
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Facebook authorization URL:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to initiate Facebook connection. Please try again.';
        alert(`Error: ${errorMessage}`);
      }
    });
  }
}


