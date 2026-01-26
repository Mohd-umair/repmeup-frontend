import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformService, PlatformConnection } from '../../core/services/platform.service';
import { OrganizationService, AutoReplySettings } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

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
    enabledPlatforms: ['youtube', 'instagram', 'facebook', 'google', 'linkedin'],
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
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: 'fab fa-linkedin',
      brandColor: '#0A66C2',
      gradientFrom: '#0A66C2',
      gradientTo: '#004182',
      description: 'Manage LinkedIn company page posts and comments',
      connected: false,
      loading: false
    }
  ];

  constructor(
    private platformService: PlatformService,
    private organizationService: OrganizationService,
    private authService: AuthService,
    private notificationService: NotificationService,
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
          this.notificationService.success(
            'Platform Connected',
            `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`
          );
        }, 500);
        
        // Clean URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {}
        });
      } else if (params['connection'] === 'facebook') {
        // Facebook-specific callback handling
        if (params['status'] === 'success') {
          const pages = params['pages'];
          if (pages && parseInt(pages) > 0) {
            this.notificationService.success(
              'Facebook Connected',
              `${pages} page(s) connected successfully.`
            );
          } else {
            this.notificationService.warning(
              'Facebook Connected with Issues',
              'No pages were saved. Please ensure you have Facebook Pages with appropriate permissions.'
            );
          }
          // Reload connections
          this.loadPlatformConnections();
        } else if (params['status'] === 'error') {
          const errorMessage = params['message'] || 'Unknown error occurred';
          
          if (errorMessage.includes('No pages found')) {
            const details = [
              '1. Make sure you have a Facebook Page',
              '2. Ensure you have Admin/Editor role on the Page',
              '3. Grant all requested permissions during OAuth'
            ];
            this.notificationService.showWithDetails(
              'error',
              'Facebook Connection Failed',
              errorMessage,
              details,
              10000
            );
          } else {
            this.notificationService.error(
              'Facebook Connection Failed',
              errorMessage,
              8000
            );
          }
        }
      } else if (params['connection'] === 'instagram') {
        // Instagram-specific callback handling
        if (params['status'] === 'success') {
          const accounts = parseInt(params['accounts'] || '0', 10);
          
          // If 0 accounts connected, treat as error
          if (accounts === 0) {
            const details = [
              '1. Make sure your Instagram account is a Business account',
              '2. Link your Instagram Business account to a Facebook Page',
              '3. Ensure you have Admin/Editor role on the Facebook Page',
              '4. Try connecting again'
            ];
            this.notificationService.showWithDetails(
              'error',
              'Instagram Connection Issue',
              'No Instagram Business accounts were saved. Your account must be a Business account linked to a Facebook Page.',
              details,
              12000
            );
          } else {
            this.loadPlatformConnections();
            setTimeout(() => {
              this.notificationService.success(
                'Instagram Connected',
                `${accounts} account(s) connected successfully!`
              );
            }, 500);
          }
        } else if (params['status'] === 'error') {
          const errorMessage = decodeURIComponent(params['message'] || 'Connection failed');
          
          let details: string[] = [];
          let message = errorMessage;
          
          if (errorMessage.includes('No Instagram Business accounts found')) {
            details = [
              '1. Make sure your Instagram account is a Business account',
              '2. Link your Instagram Business account to a Facebook Page',
              '3. Ensure you have Admin/Editor role on the Facebook Page',
              '',
              'Note: You\'ll see Facebook login - this is normal and required by Meta.'
            ];
          } else if (errorMessage.includes('No Facebook pages found')) {
            details = [
              '1. Create a Facebook Page',
              '2. Link your Instagram Business account to the Page',
              '3. Try connecting again'
            ];
          } else if (errorMessage.includes('Failed to save')) {
            message = `${errorMessage}. Please check backend logs for details and try again.`;
          }
          
          if (details.length > 0) {
            this.notificationService.showWithDetails(
              'error',
              'Instagram Connection Failed',
              message,
              details,
              12000
            );
          } else {
            this.notificationService.error(
              'Instagram Connection Failed',
              message,
              8000
            );
          }
        }
        
        // Clean URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {}
        });
      } else if (params['connection'] === 'linkedin') {
        // LinkedIn-specific callback handling
        if (params['status'] === 'success') {
          const accounts = parseInt(params['accounts'] || '0', 10);
          const organizations = parseInt(params['organizations'] || '0', 10);
          
          if (accounts === 0) {
            const details = [
              '1. Create or get admin access to a LinkedIn Company Page',
              '2. Ensure you have "Administrator" role on the page',
              '3. Try connecting again'
            ];
            this.notificationService.showWithDetails(
              'error',
              'LinkedIn Connection Issue',
              'No LinkedIn organizations were saved. You need to be an administrator of a LinkedIn Company Page.',
              details,
              10000
            );
          } else {
            this.loadPlatformConnections();
            setTimeout(() => {
              this.notificationService.success(
                'LinkedIn Connected',
                `${accounts} organization(s) connected successfully!`
              );
            }, 500);
          }
        } else if (params['status'] === 'error') {
          const errorMessage = decodeURIComponent(params['message'] || 'Connection failed');
          
          if (errorMessage.includes('organization') || errorMessage.includes('Company Page')) {
            const details = [
              '1. You must have a LinkedIn Company Page',
              '2. You must be an Administrator of the page',
              '3. Grant all requested permissions during OAuth'
            ];
            this.notificationService.showWithDetails(
              'error',
              'LinkedIn Connection Failed',
              errorMessage,
              details,
              10000
            );
          } else {
            this.notificationService.error(
              'LinkedIn Connection Failed',
              errorMessage,
              8000
            );
          }
        }
        
        // Clean URL
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {}
        });
      } else if (params['error']) {
        // Connection error
        this.notificationService.error(
          'Connection Failed',
          params['error']
        );
        
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
              (connection.platform === 'youtube' && p.id === 'youtube') ||
              (connection.platform === 'linkedin' && p.id === 'linkedin')
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
                this.notificationService.success(
                  'Platform Disconnected',
                  `${platform.name} has been disconnected successfully.`
                );
              } else {
                this.notificationService.error(
                  'Disconnect Failed',
                  'Failed to disconnect. Please try again.'
                );
              }
              platform.loading = false;
            },
            error: (error) => {
              console.error('Error disconnecting platform:', error);
              const errorMessage = error.error?.error || error.error?.message || 'Failed to disconnect. Please try again.';
              this.notificationService.error(
                'Disconnect Error',
                errorMessage
              );
              platform.loading = false;
            }
          });
        } else {
          this.notificationService.error(
            'Connection Not Found',
            'Connection ID not found. Please refresh the page and try again.'
          );
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
      } else if (platform.id === 'instagram') {
        // Instagram OAuth flow
        this.platformService.connectInstagram();
      } else if (platform.id === 'facebook') {
        // Facebook OAuth flow
        this.platformService.connectFacebook();
      } else if (platform.id === 'linkedin') {
        // LinkedIn OAuth flow
        this.platformService.connectLinkedIn();
      } else {
        // Other platforms - show coming soon
        platform.loading = false;
        this.notificationService.info(
          'Coming Soon',
          `${platform.name} integration is coming soon!`
        );
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
          this.notificationService.success(
            'Sync Completed',
            `Found ${response.data?.interactionsAdded || 0} new interactions.`
          );
          this.loadPlatformConnections(); // Reload to get updated data
        }
        platform.loading = false;
      },
      error: (error) => {
        console.error('Error syncing platform:', error);
        const errorMessage = error.error?.error || error.message || 'Failed to sync. Please try again.';
        this.notificationService.error(
          'Sync Failed',
          errorMessage
        );
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
      this.notificationService.error(
        'Organization Not Found',
        'Organization ID not found. Please refresh the page.'
      );
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
          this.notificationService.success(
            'Settings Saved',
            'Auto-reply settings saved successfully!'
          );
          
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
        this.notificationService.error(
          'Save Failed',
          errorMessage
        );
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
