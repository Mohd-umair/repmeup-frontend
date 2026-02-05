import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * Interface for Instagram account data
 */
interface InstagramAccount {
  id: string;
  username: string;
  profilePicture: string;
}

/**
 * Interface for connection status
 */
interface ConnectionStatus {
  connected: boolean;
  connectionId?: string;
  username?: string;
}

/**
 * Interface for Facebook Page from API
 */
interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  hasInstagram: boolean;
  instagram: InstagramAccount | null;
  connections: {
    facebook: ConnectionStatus;
    instagram: ConnectionStatus;
  };
}

/**
 * Page Manager Component
 * Manages multiple Facebook Pages and Instagram accounts
 */
@Component({
  selector: 'app-page-manager',
  templateUrl: './page-manager.component.html',
  styleUrls: ['./page-manager.component.scss']
})
export class PageManagerComponent implements OnInit {
  // Data
  pages: FacebookPage[] = [];
  
  // State
  loading = false;
  refreshing = false;
  showModal = false;
  
  // Action tracking
  connectingPageId: string | null = null;
  connectingPlatform: 'facebook' | 'instagram' | null = null;
  disconnectingId: string | null = null;

  // Events
  @Output() connectionChanged = new EventEmitter<void>();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Auto-load on init
    this.loadPages();
  }

  /**
   * Load all Facebook Pages user can manage
   */
  async loadPages(): Promise<void> {
    this.loading = true;
    try {
      const response = await this.http.get<any>(
        `${environment.apiUrl}/meta/pages`
      ).toPromise();

      if (response.success) {
        this.pages = response.pages || [];
        
        if (this.pages.length === 0) {
          this.notificationService.info(
            'No Pages Found',
            'You don\'t have any Facebook Pages yet. Create a Page on Facebook to get started.'
          );
        }
      } else {
        throw new Error(response.message || 'Failed to load pages');
      }
    } catch (error: any) {
      console.error('Error loading pages:', error);
      
      if (error.status === 404) {
        this.notificationService.error(
          'Not Connected',
          'Please connect your Facebook account first'
        );
      } else {
        this.notificationService.error(
          'Error',
          error.error?.message || 'Failed to load Facebook Pages'
        );
      }
      
      this.pages = [];
    } finally {
      this.loading = false;
      this.refreshing = false;
    }
  }

  /**
   * Refresh pages list
   */
  async refreshPages(): Promise<void> {
    this.refreshing = true;
    await this.loadPages();
    
    if (!this.loading) {
      this.notificationService.success(
        'Refreshed',
        'Pages list updated successfully'
      );
    }
  }

  /**
   * Connect a Facebook Page or Instagram account
   */
  async connectAccount(
    page: FacebookPage, 
    platform: 'facebook' | 'instagram'
  ): Promise<void> {
    // Prevent double-click
    if (this.connectingPageId || this.disconnectingId) {
      return;
    }

    // Validate Instagram connection
    if (platform === 'instagram' && !page.hasInstagram) {
      this.notificationService.error(
        'No Instagram Account',
        'This Facebook Page doesn\'t have an Instagram Business Account linked'
      );
      return;
    }

    this.connectingPageId = page.id;
    this.connectingPlatform = platform;

    try {
      const payload: any = {
        platform,
        pageName: page.name,
        pageAccessToken: page.accessToken
      };

      // Add Instagram data if connecting Instagram
      if (platform === 'instagram' && page.instagram) {
        payload.instagramData = {
          id: page.instagram.id,
          username: page.instagram.username,
          profilePicture: page.instagram.profilePicture
        };
      }

      const response = await this.http.post<any>(
        `${environment.apiUrl}/meta/pages/${page.id}/connect`,
        payload
      ).toPromise();

      if (response.success) {
        const accountName = platform === 'facebook' 
          ? page.name 
          : `@${page.instagram?.username}`;
        
        this.notificationService.success(
          'Connected',
          `${accountName} connected successfully`
        );

        // Reload pages to update connection status
        await this.loadPages();
        
        // Emit event for parent component
        this.connectionChanged.emit();
      } else {
        throw new Error(response.message || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Error connecting account:', error);
      this.notificationService.error(
        'Connection Failed',
        error.error?.message || 'Failed to connect account'
      );
    } finally {
      this.connectingPageId = null;
      this.connectingPlatform = null;
    }
  }

  /**
   * Disconnect a Facebook Page or Instagram account
   */
  async disconnectAccount(
    page: FacebookPage,
    platform: 'facebook' | 'instagram'
  ): Promise<void> {
    // Prevent double-click
    if (this.connectingPageId || this.disconnectingId) {
      return;
    }

    const connection = platform === 'facebook' 
      ? page.connections.facebook 
      : page.connections.instagram;

    if (!connection.connected || !connection.connectionId) {
      return;
    }

    const accountName = platform === 'facebook'
      ? page.name
      : `@${connection.username}`;

    // Confirm disconnect
    if (!confirm(`Are you sure you want to disconnect ${accountName}?`)) {
      return;
    }

    this.disconnectingId = connection.connectionId;

    try {
      const response = await this.http.delete<any>(
        `${environment.apiUrl}/meta/connections/${connection.connectionId}`
      ).toPromise();

      if (response.success) {
        this.notificationService.success(
          'Disconnected',
          `${accountName} disconnected successfully`
        );

        // Reload pages to update connection status
        await this.loadPages();
        
        // Emit event for parent component
        this.connectionChanged.emit();
      } else {
        throw new Error(response.message || 'Disconnect failed');
      }
    } catch (error: any) {
      console.error('Error disconnecting account:', error);
      this.notificationService.error(
        'Disconnect Failed',
        error.error?.message || 'Failed to disconnect account'
      );
    } finally {
      this.disconnectingId = null;
    }
  }

  /**
   * Check if action is in progress for a specific account
   */
  isActionInProgress(pageId: string, platform: 'facebook' | 'instagram'): boolean {
    return (this.connectingPageId === pageId && this.connectingPlatform === platform) ||
           (this.disconnectingId !== null);
  }

  /**
   * Open the page manager modal
   */
  openModal(): void {
    this.showModal = true;
    if (this.pages.length === 0) {
      this.loadPages();
    }
  }

  /**
   * Close the modal
   */
  closeModal(): void {
    this.showModal = false;
  }

  /**
   * Get count of connected accounts
   */
  getConnectedCount(): number {
    let count = 0;
    this.pages.forEach(page => {
      if (page.connections.facebook.connected) count++;
      if (page.connections.instagram.connected) count++;
    });
    return count;
  }

  /**
   * Get count of available accounts
   */
  getAvailableCount(): number {
    let count = 0;
    this.pages.forEach(page => {
      count++; // Facebook Page
      if (page.hasInstagram) count++; // Instagram account
    });
    return count;
  }
}
