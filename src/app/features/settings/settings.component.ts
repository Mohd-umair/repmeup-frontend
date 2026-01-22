import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformService, PlatformConnection } from '../../core/services/platform.service';
import { OrganizationService, AutoReplySettings } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Settings Component - Single Responsibility Principle
 * Manages application settings and platform connections
 */

interface Platform {
  id: string;
  name: string;
  icon: string;
  brandColor: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
  connected: boolean;
  connectedAccount?: string;
  lastSync?: string;
  dataPoints?: number;
  connectionId?: string; // Store connection ID for disconnect/sync
  loading?: boolean; // Loading state for connect/disconnect
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  activeTab = 'platforms';
  loading = false;
  savingSettings = false;
  organizationId: string = '';

  // Auto-reply settings
  autoReplySettings: AutoReplySettings = {
    enabled: false,
    enabledPlatforms: ['youtube', 'instagram', 'facebook', 'google'],
    enabledTypes: ['comment', 'review'],
    sentimentFilter: 'all',
    replyToNegative: false,
    replyToComplaints: false,
    minConfidence: 0.75,
    autoSend: false,
    requireApproval: true,
    maxRepliesPerDay: 50,
    repliesCountToday: 0,
    // Scheduling settings
    triggerMode: 'hybrid',
    webhookImmediate: true,
    webhookDelay: 5,
    scheduleInterval: '24hours',
    scheduleEnabled: true
  };

  platforms: Platform[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: 'fab fa-instagram',
      brandColor: '#E4405F',
      gradientFrom: '#833AB4',
      gradientTo: '#FD1D1D',
      description: 'Connect your Instagram Business account to manage comments and DMs',
      connected: false,
      loading: false
    },
    {
      id: 'facebook',
      name: 'Facebook',
      icon: 'fab fa-facebook',
      brandColor: '#1877F2',
      gradientFrom: '#1877F2',
      gradientTo: '#0C63D4',
      description: 'Manage Facebook page comments, reviews, and messages',
      connected: false,
      loading: false
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: 'fab fa-youtube',
      brandColor: '#FF0000',
      gradientFrom: '#FF0000',
      gradientTo: '#CC0000',
      description: 'Monitor and respond to YouTube video comments',
      connected: false,
      loading: false
    },
    {
      id: 'google',
      name: 'Google Business',
      icon: 'fab fa-google',
      brandColor: '#4285F4',
      gradientFrom: '#4285F4',
      gradientTo: '#34A853',
      description: 'Manage Google Business Profile reviews and Q&A',
      connected: false,
      loading: false
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: 'fab fa-whatsapp',
      brandColor: '#25D366',
      gradientFrom: '#25D366',
      gradientTo: '#128C7E',
      description: 'Handle WhatsApp Business API messages',
      connected: false,
      loading: false
    },
    {
      id: 'twitter',
      name: 'Twitter (X)',
      icon: 'fab fa-twitter',
      brandColor: '#1DA1F2',
      gradientFrom: '#1DA1F2',
      gradientTo: '#0C85D0',
      description: 'Monitor mentions, replies, and direct messages',
      connected: false,
      loading: false
    }
  ];

  constructor(
    private platformService: PlatformService,
    private organizationService: OrganizationService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get organization ID from current user
    this.authService.currentUser$.subscribe(user => {
      if (user && user.organization) {
        this.organizationId = typeof user.organization === 'string' ? user.organization : user.organization._id;
        this.loadAutoReplySettings();
      }
    });

    // Check for OAuth callback parameters
    this.route.queryParams.subscribe(params => {
      if (params['connected']) {
        // Successfully connected
        const platform = params['connected'];
        this.loadPlatformConnections();
        
        // Show success message
        setTimeout(() => {
          alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`);
        }, 500);
        
        // Clean URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {}
        });
      } else if (params['error']) {
        // Connection error
        alert(`Connection failed: ${params['error']}`);
        
        // Clean URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {}
        });
      }
    });

    // Load existing connections
    this.loadPlatformConnections();
  }

  /**
   * Load platform connections from backend
   */
  loadPlatformConnections(): void {
    this.loading = true;
    
    // First, reset all platforms to disconnected state
    this.platforms.forEach(platform => {
      platform.connected = false;
      platform.connectionId = undefined;
      platform.connectedAccount = undefined;
      platform.lastSync = undefined;
      platform.dataPoints = undefined;
    });
    
    this.platformService.getPlatformConnections().subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          // Map backend connections to frontend platform array
          response.data.forEach((connection: PlatformConnection) => {
            const platform = this.platforms.find(p => 
              p.id === connection.platform || 
              (connection.platform === 'google' && p.id === 'google') ||
              (connection.platform === 'youtube' && p.id === 'youtube')
            );

            if (platform && connection.isActive && connection.status === 'connected') {
              platform.connected = true;
              platform.connectionId = connection._id;
              platform.connectedAccount = connection.platformDisplayName || 
                                        connection.platformUsername || 
                                        connection.platformEmail || 
                                        'Connected Account';
              
              if (connection.lastSyncAt) {
                const lastSync = new Date(connection.lastSyncAt);
                const now = new Date();
                const diffMs = now.getTime() - lastSync.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);

                if (diffMins < 1) {
                  platform.lastSync = 'Just now';
                } else if (diffMins < 60) {
                  platform.lastSync = `${diffMins} min ago`;
                } else if (diffHours < 24) {
                  platform.lastSync = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                } else {
                  platform.lastSync = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                }
              } else {
                platform.lastSync = 'Never';
              }
            }
          });
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading platform connections:', error);
        this.loading = false;
      }
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  /**
   * Connect or disconnect a platform
   */
  connectPlatform(platform: Platform): void {
    if (!platform) {
      console.error('Platform is undefined');
      return;
    }

    console.log('connectPlatform called for:', platform.id, 'Connected:', platform.connected, 'Loading:', platform.loading);

    if (platform.connected) {
      // Disconnect logic
      if (confirm(`Are you sure you want to disconnect ${platform.name}? This will stop syncing data from this platform.`)) {
        if (platform.connectionId) {
          platform.loading = true;
          const connectionIdToDisconnect = platform.connectionId; // Store ID before clearing
          
          this.platformService.disconnectPlatform(connectionIdToDisconnect).subscribe({
            next: (response) => {
              if (response.success) {
                // Reset platform state
                platform.connected = false;
                platform.connectedAccount = undefined;
                platform.lastSync = undefined;
                platform.dataPoints = undefined;
                platform.connectionId = undefined;
                
                // Reload connections to ensure UI is in sync
                this.loadPlatformConnections();
                
                // Show success message
                alert(`${platform.name} has been disconnected successfully.`);
              } else {
                alert('Failed to disconnect. Please try again.');
              }
              platform.loading = false;
            },
            error: (error) => {
              console.error('Error disconnecting platform:', error);
              const errorMessage = error.error?.error || error.error?.message || 'Failed to disconnect. Please try again.';
              alert(`Error: ${errorMessage}`);
              platform.loading = false;
            }
          });
        } else {
          alert('Connection ID not found. Please refresh the page and try again.');
        }
      }
    } else {
      // Connect logic
      platform.loading = true;

      // Handle Google platforms (Google Business Profile and YouTube)
      if (platform.id === 'google') {
        this.platformService.connectGoogle('reviews');
      } else if (platform.id === 'youtube') {
        this.platformService.connectGoogle('youtube');
      } else {
        // Other platforms - show coming soon
        platform.loading = false;
        alert(`${platform.name} integration is coming soon!`);
      }
    }
  }

  /**
   * Manually sync platform data
   */
  syncPlatform(platform: Platform): void {
    if (!platform.connectionId) {
      return;
    }

    platform.loading = true;
    this.platformService.syncPlatform(platform.connectionId).subscribe({
      next: (response) => {
        if (response.success) {
          platform.lastSync = 'Just now';
          alert(`Sync completed! ${response.data?.interactionsAdded || 0} new interactions found.`);
          this.loadPlatformConnections(); // Reload to get updated data
        }
        platform.loading = false;
      },
      error: (error) => {
        console.error('Error syncing platform:', error);
        alert('Failed to sync. Please try again.');
        platform.loading = false;
      }
    });
  }

  getConnectedCount(): number {
    return this.platforms.filter(p => p.connected).length;
  }

  getPendingCount(): number {
    return this.platforms.filter(p => !p.connected).length;
  }

  /**
   * Load auto-reply settings from organization
   */
  loadAutoReplySettings(): void {
    if (!this.organizationId) {
      return;
    }

    this.organizationService.getOrganization(this.organizationId).subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.autoReplySettings) {
          this.autoReplySettings = {
            ...this.autoReplySettings,
            ...response.data.autoReplySettings
          };
        }
      },
      error: (error) => {
        console.error('Error loading auto-reply settings:', error);
      }
    });
  }

  /**
   * Save auto-reply settings
   */
  saveAutoReplySettings(): void {
    if (!this.organizationId) {
      alert('Organization ID not found. Please refresh the page.');
      return;
    }

    this.savingSettings = true;

    // Debug: Log what we're sending
    console.log('Saving auto-reply settings:', {
      scheduleInterval: this.autoReplySettings.scheduleInterval,
      webhookDelay: this.autoReplySettings.webhookDelay,
      triggerMode: this.autoReplySettings.triggerMode,
      fullSettings: this.autoReplySettings
    });

    this.organizationService.updateAutoReplySettings(this.organizationId, this.autoReplySettings).subscribe({
      next: (response) => {
        if (response.success) {
          alert('Auto-reply settings saved successfully!');
          
          // Update local settings with response
          if (response.data && response.data.autoReplySettings) {
            this.autoReplySettings = {
              ...this.autoReplySettings,
              ...response.data.autoReplySettings
            };
          }
        }
        this.savingSettings = false;
      },
      error: (error) => {
        console.error('Error saving auto-reply settings:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to save settings. Please try again.';
        alert(`Error: ${errorMessage}`);
        this.savingSettings = false;
      }
    });
  }

  /**
   * Toggle platform in enabled platforms list
   */
  togglePlatform(platform: string): void {
    const index = this.autoReplySettings.enabledPlatforms.indexOf(platform);
    if (index > -1) {
      this.autoReplySettings.enabledPlatforms.splice(index, 1);
    } else {
      this.autoReplySettings.enabledPlatforms.push(platform);
    }
  }

  /**
   * Toggle interaction type in enabled types list
   */
  toggleType(type: string): void {
    const index = this.autoReplySettings.enabledTypes.indexOf(type);
    if (index > -1) {
      this.autoReplySettings.enabledTypes.splice(index, 1);
    } else {
      this.autoReplySettings.enabledTypes.push(type);
    }
  }
}
