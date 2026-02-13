import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PlatformService, PlatformConnection } from '../../core/services/platform.service';
import { OrganizationService, AutoReplySettings } from '../../core/services/organization.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PlatformConnectionService, PlatformConnectionUsage } from '../../core/services/platform-connection.service';
import { SubscriptionService, ISubscriptionLimits } from '../../core/services/subscription.service';
import { SocialAccountsService, ISocialAccount } from '../../core/services/social-accounts.service';
import { Observable, Subscription } from 'rxjs';

/**
 * Settings Component - Single Responsibility Principle
 * Manages application settings and platform connections
 */

// All available settings tabs
type SettingsTab = 'platforms' | 'platforms-old' | 'profile' | 'organization' | 'security' | 'notifications' | 'auto-reply';

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
export class SettingsComponent implements OnInit, OnDestroy {
  activeTab: SettingsTab = 'platforms';
  loading = false;
  savingSettings = false;
  organizationId: string = '';
  
  // New: Connection usage and limits (SOLID: Single Responsibility)
  usage$: Observable<PlatformConnectionUsage | null>;
  connections$: Observable<any[]>;
  canAddConnection = true;
  connectionLimitMessage = '';
  
  // Subscription management
  subscriptionLimits$: Observable<ISubscriptionLimits | null>;
  subscriptionLimits: ISubscriptionLimits | null = null;
  loadingSubscription = false;
  
  // Available accounts (authenticated but not connected)
  availableAccounts: ISocialAccount[] = [];
  loadingAvailableAccounts = false;
  
  // Meta page selector modal
  showMetaPageSelector = false;
  
  // Plans modal
  showPlansModal = false;
  allPlans: any = null;
  upgradingPlan = false;

  private subscriptions: Subscription[] = [];

  // Auto-reply settings
  autoReplySettings: AutoReplySettings = {
    enabled: false,
    enabledPlatforms: ['youtube', 'instagram', 'facebook', 'google', 'linkedin', 'whatsapp'],
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
      id: 'linkedin',
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
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: 'fab fa-whatsapp',
      brandColor: '#25D366',
      gradientFrom: '#25D366',
      gradientTo: '#128C7E',
      description: 'Connect WhatsApp Business API to manage customer messages',
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
    private router: Router,
    public platformConnectionService: PlatformConnectionService, // SOLID: Dependency Injection
    private subscriptionService: SubscriptionService,
    private socialAccountsService: SocialAccountsService
  ) {
    // Initialize observables (reactive state management)
    this.usage$ = this.platformConnectionService.usage$;
    this.connections$ = this.platformConnectionService.connections$;
    this.subscriptionLimits$ = this.subscriptionService.limits$;
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.authService.currentUser$.subscribe(user => {
        if (user && user.organization) {
          this.organizationId = typeof user.organization === 'string' ? user.organization : user.organization._id;
          this.loadAutoReplySettings();
        }
      })
    );

    this.platformConnectionService.startPolling();
    this.loadSubscriptionLimits();
    this.loadAvailableAccounts();

    this.subscriptions.push(
      this.subscriptionLimits$.subscribe(limits => {
        if (limits) {
          this.subscriptionLimits = limits;
        }
      })
    );

    this.subscriptions.push(
      this.route.queryParams.subscribe(params => {
      if (params['connected']) {
        // Successfully connected
        const platform = params['connected'];
        this.loadPlatformConnections();
        // CRITICAL: Refresh subscription limits to update connection count
        this.loadSubscriptionLimits();
        
        // Show success message
        setTimeout(() => {
          this.notificationService.success(
            'Platform Connected',
            `${platform.charAt(0).toUpperCase() + platform.slice(1)} connected successfully!`
          );
          
          // If Facebook was just connected, automatically open page selector
          if (platform === 'facebook') {
            setTimeout(() => {
              this.notificationService.info(
                'Select Pages',
                'Now choose which Facebook pages and Instagram accounts to connect'
              );
              this.showMetaPageSelector = true;
            }, 1500);
          }
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
          
          // Reload connections first and wait for it to complete
          this.loadPlatformConnections();
          // CRITICAL: Refresh subscription limits to update connection count
          this.loadSubscriptionLimits();
          
          // Also refresh the platform connection service
          this.platformConnectionService.refresh().subscribe({
            next: () => {
              console.log('✅ Platform connections refreshed after Facebook OAuth');
              
              // Show success message after connections are loaded
              setTimeout(() => {
                this.notificationService.success(
                  'Facebook Connected',
                  `You have access to ${pages} page(s). Now select which ones to connect.`
                );
                
                // Auto-open page selector after successful Facebook connection
                // Give it 2 seconds to ensure database write completes
                setTimeout(() => {
                  console.log('🎯 Opening Meta Page Selector after Facebook OAuth...');
                  this.showMetaPageSelector = true;
                }, 2000);
              }, 500);
            },
            error: (err) => {
              console.error('❌ Failed to refresh connections:', err);
              this.notificationService.success(
                'Facebook Connected',
                `You have access to ${pages} page(s).`
              );
            }
          });
          
          // Clean URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {}
          });
          
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
          
          // Clean URL after error
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {}
          });
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
            // CRITICAL: Refresh subscription limits to update connection count
            this.loadSubscriptionLimits();
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
            // CRITICAL: Refresh subscription limits to update connection count
            this.loadSubscriptionLimits();
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
    })
    );

    this.loadPlatformConnections();
  }

  /**
   * Load platform connections from backend (SOLID: Uses service abstraction)
   */
  loadPlatformConnections(): void {
    this.loading = true;
    
    // Use the new PlatformConnectionService (Single Responsibility)
    this.platformConnectionService.getConnections().subscribe({
      next: (response) => {
        if (response.success) {
          // Check if can add more connections
          this.updateConnectionLimitStatus(response.usage);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading platform connections:', error);
        this.notificationService.error(
          'Load Failed',
          'Failed to load platform connections. Please try again.'
        );
        this.loading = false;
      }
    });
  }

  /**
   * Update connection limit status (Open/Closed: Easy to extend)
   */
  private updateConnectionLimitStatus(usage: PlatformConnectionUsage): void {
    const remaining = usage.remaining;
    this.canAddConnection = remaining > 0;
    
    if (!this.canAddConnection) {
      this.connectionLimitMessage = `Plan limit reached (${usage.current}/${usage.max}). Upgrade to add more.`;
    } else {
      this.connectionLimitMessage = `You can add ${remaining} more account${remaining !== 1 ? 's' : ''}`;
    }
  }

  setActiveTab(tab: SettingsTab): void {
    this.activeTab = tab;
  }

  /**
   * Connect or disconnect a platform
   */
  /**
   * Check if can add connection before starting OAuth (SOLID: Open/Closed)
   */
  checkConnectionLimitBeforeConnect(platform: Platform): boolean {
    if (!this.canAddConnection) {
      this.notificationService.warning(
        'Plan Limit Reached',
        this.connectionLimitMessage
      );
      return false;
    }
    return true;
  }

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
                // CRITICAL: Refresh subscription limits to update connection count
                this.loadSubscriptionLimits();
                
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
      // Connect logic - Check limit first (SOLID: Single Responsibility)
      if (!this.checkConnectionLimitBeforeConnect(platform)) {
        return;
      }
      
      platform.loading = true;

      // Handle Google platforms (Google Business Profile and YouTube)
      if (platform.id === 'google') {
        this.platformService.connectGoogle('reviews');
      } else if (platform.id === 'youtube') {
        this.platformService.connectGoogle('youtube');
      } else if (platform.id === 'instagram') {
        // Instagram OAuth flow (will show page selector after callback)
        this.platformService.connectInstagram();
      } else if (platform.id === 'facebook') {
        // Facebook OAuth flow (will show page selector after callback)
        this.platformService.connectFacebook();
      } else if (platform.id === 'linkedin') {
        // LinkedIn OAuth flow
        this.platformService.connectLinkedIn();
      } else if (platform.id === 'whatsapp') {
        // WhatsApp Business API connection
        this.platformService.connectWhatsApp().subscribe({
          next: (response) => {
            if (response.success) {
              platform.connected = true;
              platform.connectionId = response.data._id;
              platform.connectedAccount = response.data.platformData.verifiedName || 
                                         response.data.platformData.displayPhoneNumber || 
                                         'WhatsApp Business';
              this.notificationService.success(
                'WhatsApp Connected',
                'WhatsApp Business API connected successfully!'
              );
              this.loadPlatformConnections();
              // CRITICAL: Refresh subscription limits to update connection count
              this.loadSubscriptionLimits();
            }
            platform.loading = false;
          },
          error: (error) => {
            console.error('Error connecting WhatsApp:', error);
            const errorMessage = error.error?.error || error.error?.message || 'Failed to connect WhatsApp. Please check your credentials.';
            this.notificationService.error(
              'Connection Failed',
              errorMessage
            );
            platform.loading = false;
          }
        });
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
    // Use the actual usage data from the service instead of the static platforms array
    const usage = this.platformConnectionService.getCurrentUsage();
    return usage ? usage.current : 0;
  }

  getPendingCount(): number {
    // Calculate available platforms: max limit minus current connections
    const usage = this.platformConnectionService.getCurrentUsage();
    return usage ? usage.remaining : 0;
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

  /**
   * Handle sync from connected accounts list (SOLID: Dependency Inversion)
   */
  onSyncConnection(connection: any): void {
    this.platformConnectionService.syncConnection(connection._id).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Sync Completed',
            `Found ${response.data?.interactionsAdded || 0} new interactions.`
          );
          // Refresh connections to update last sync time
          this.platformConnectionService.refresh().subscribe();
        }
      },
      error: (error) => {
        console.error('Error syncing connection:', error);
        const errorMessage = error.error?.error || error.message || 'Failed to sync. Please try again.';
        this.notificationService.error(
          'Sync Failed',
          errorMessage
        );
      }
    });
  }

  /**
   * Handle disconnect from connected accounts list (SOLID: Dependency Inversion)
   */
  onDisconnectConnection(connection: any): void {
    this.platformConnectionService.disconnectConnection(connection._id).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Account Disconnected',
            `${connection.platformDisplayName || connection.platformUsername || 'Account'} has been disconnected.`
          );
          // Service already updated state optimistically
        }
      },
      error: (error) => {
        console.error('Error disconnecting connection:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to disconnect. Please try again.';
        this.notificationService.error(
          'Disconnect Failed',
          errorMessage
        );
        // Refresh on error to restore correct state
        this.platformConnectionService.refresh().subscribe();
      }
    });
  }

  /**
   * Handle refresh Google locations (SOLID: Dependency Inversion)
   */
  onRefreshLocations(connection: any): void {
    this.platformConnectionService.refreshGoogleLocations(connection._id).subscribe({
      next: (response) => {
        if (response.success) {
          const locationsCount = response.data?.locationsCount || 0;
          const locationNames = response.data?.locationNames || [];
          
          if (locationsCount === 0) {
            // Still no locations found
            const details = [
              '1. Visit https://business.google.com/',
              '2. Create or claim your business location',
              '3. Verify your business with Google',
              '4. Click "Setup Locations" again to retry'
            ];
            this.notificationService.showWithDetails(
              'info',
              'Setup Required',
              'No business locations found. Please follow these steps:',
              details,
              10000
            );
          } else {
            // Locations found successfully
            const locationList = locationNames.length > 0 
              ? locationNames.join(', ') 
              : '';
            this.notificationService.success(
              'Locations Found',
              `Successfully configured ${locationsCount} business location${locationsCount !== 1 ? 's' : ''}: ${locationList}`,
              8000
            );
            // Refresh connections to update UI
            this.platformConnectionService.refresh().subscribe();
          }
        }
      },
      error: (error) => {
        console.error('Error refreshing locations:', error);
        const errorCode = error.error?.code;
        const errorMessage = error.error?.message || error.error?.error || 'Failed to fetch locations. Please try again.';
        
        if (errorCode === 'NO_ACCOUNTS') {
          const details = [
            '1. Visit https://business.google.com/',
            '2. Sign in with your Google account',
            '3. Create a new Business Profile',
            '4. Verify your business',
            '5. Return here and click "Setup Locations" again'
          ];
          this.notificationService.showWithDetails(
            'warning',
            'Google Business Profile Not Found',
            errorMessage,
            details,
            12000
          );
        } else if (errorCode === 'NO_LOCATIONS') {
          const details = [
            '1. Visit https://business.google.com/',
            '2. Go to "Locations" section',
            '3. Add or claim your business location',
            '4. Complete the verification process',
            '5. Click "Setup Locations" again'
          ];
          this.notificationService.showWithDetails(
            'warning',
            'No Business Locations',
            errorMessage,
            details,
            12000
          );
        } else if (errorCode === 'API_ACCESS_DENIED') {
          const details = [
            '1. Disconnect this Google account',
            '2. Reconnect and grant all requested permissions',
            '3. Ensure you have a Google Business Profile set up'
          ];
          this.notificationService.showWithDetails(
            'error',
            'Access Denied',
            errorMessage,
            details,
            10000
          );
        } else {
          this.notificationService.error(
            'Setup Failed',
            errorMessage
          );
        }
      }
    });
  }

  /**
   * Open Meta page selector modal (Step 8)
   * First checks if Facebook is connected, if not initiates OAuth flow
   */
  openMetaPageSelector(): void {
    if (!this.canAddConnection) {
      this.notificationService.warning(
        'Plan Limit Reached',
        this.connectionLimitMessage
      );
      return;
    }

    // Check if user has any Facebook connections
    this.connections$.subscribe(connections => {
      const hasFacebookConnection = connections.some(
        conn => conn.platform === 'facebook' && conn.isActive
      );

      if (!hasFacebookConnection) {
        // No Facebook connection yet - initiate OAuth flow first
        this.notificationService.info(
          'Connecting Facebook',
          'Redirecting to Facebook to authorize access...'
        );
        
        // Find Facebook platform and connect using standard flow
        const facebookPlatform = this.platforms.find(p => p.id === 'facebook');
        if (facebookPlatform) {
          this.connectPlatform(facebookPlatform);
        }
      } else {
        // Facebook is connected - show page selector
        this.showMetaPageSelector = true;
      }
    }).unsubscribe(); // Unsubscribe immediately after checking
  }

  /**
   * Handle pages connected from modal (Step 8)
   */
  onPagesConnected(): void {
    this.showMetaPageSelector = false;
    // Refresh connections to show newly added accounts
    this.platformConnectionService.refresh().subscribe();
    this.loadPlatformConnections();
    // CRITICAL: Also refresh subscription limits to update connection count
    this.loadSubscriptionLimits();
  }

  /**
   * Load subscription limits and plan info
   */
  loadSubscriptionLimits(): void {
    this.loadingSubscription = true;
    this.subscriptionService.getLimits().subscribe({
      next: (response) => {
        if (response.success) {
          this.subscriptionLimits = response.data;
        }
        this.loadingSubscription = false;
      },
      error: (error) => {
        console.error('Error loading subscription limits:', error);
        this.loadingSubscription = false;
      }
    });
  }

  /**
   * Load available accounts (authenticated but not connected)
   */
  loadAvailableAccounts(): void {
    this.loadingAvailableAccounts = true;
    this.socialAccountsService.getAvailableAccounts().subscribe({
      next: (response) => {
        if (response.success) {
          this.availableAccounts = response.data.accounts || [];
        }
        this.loadingAvailableAccounts = false;
      },
      error: (error) => {
        console.error('Error loading available accounts:', error);
        this.loadingAvailableAccounts = false;
      }
    });
  }

  /**
   * Connect an available account
   */
  connectAvailableAccount(account: ISocialAccount): void {
    if (!this.subscriptionLimits || !this.subscriptionLimits.canConnectMore) {
      this.notificationService.warning(
        'Plan Limit Reached',
        `Your ${this.subscriptionLimits?.plan} plan allows ${this.subscriptionLimits?.limits.maxAccounts} accounts. Please upgrade to connect more.`
      );
      return;
    }

    this.socialAccountsService.connectAccount(account._id).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Account Connected',
            `${account.platformUsername} connected successfully!`
          );
          // Refresh both available accounts and connected accounts
          this.loadAvailableAccounts();
          this.loadSubscriptionLimits();
          this.platformConnectionService.refresh().subscribe();
        }
      },
      error: (error) => {
        console.error('Error connecting account:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to connect account';
        
        if (error.error?.error === 'ACCOUNT_LIMIT_REACHED') {
          this.notificationService.warning(
            'Plan Limit Reached',
            errorMessage
          );
        } else {
          this.notificationService.error(
            'Connection Failed',
            errorMessage
          );
        }
      }
    });
  }

  /**
   * Check if near limit (90% or more)
   */
  isNearLimit(): boolean {
    if (!this.subscriptionLimits) return false;
    return this.subscriptionService.isNearLimit(
      this.subscriptionLimits.usage.connectedAccounts,
      this.subscriptionLimits.limits.maxAccounts
    );
  }

  /**
   * Check if limit reached
   */
  isLimitReached(): boolean {
    if (!this.subscriptionLimits) return false;
    return this.subscriptionService.isLimitReached(
      this.subscriptionLimits.usage.connectedAccounts,
      this.subscriptionLimits.limits.maxAccounts
    );
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    if (!this.subscriptionLimits) return 0;
    return this.subscriptionService.getUsagePercentage(
      this.subscriptionLimits.usage.connectedAccounts,
      this.subscriptionLimits.limits.maxAccounts
    );
  }

  /**
   * When over limit, return how many accounts over (for display).
   */
  getOverLimitCount(): number {
    if (!this.subscriptionLimits || this.subscriptionLimits.limits.maxAccounts === -1) return 0;
    const over = this.subscriptionLimits.usage.connectedAccounts - this.subscriptionLimits.limits.maxAccounts;
    return Math.max(0, over);
  }

  /**
   * Show plans modal
   */
  openPlansModal(): void {
    if (!this.allPlans) {
      // Load plans if not already loaded
      this.subscriptionService.getPlans().subscribe({
        next: (response) => {
          if (response.success) {
            this.allPlans = response.data;
            this.showPlansModal = true;
          }
        },
        error: (error) => {
          console.error('Error loading plans:', error);
          this.notificationService.error(
            'Failed to Load Plans',
            'Could not load subscription plans. Please try again.'
          );
        }
      });
    } else {
      this.showPlansModal = true;
    }
  }

  /**
   * Close plans modal
   */
  closePlansModal(): void {
    this.showPlansModal = false;
  }

  /**
   * Upgrade to next tier (quick upgrade)
   */
  upgradeToNextTier(): void {
    if (!this.subscriptionLimits?.nextTier) {
      this.notificationService.info(
        'Already at Top Tier',
        'You are already on the highest available plan.'
      );
      return;
    }

    const nextPlanId = Object.keys(this.allPlans || {}).find(
      key => this.allPlans && this.allPlans[key].tier === this.subscriptionLimits!.nextTier!.tier
    );

    if (!nextPlanId) {
      this.openPlansModal();
      return;
    }

    this.confirmUpgrade(nextPlanId, this.subscriptionLimits.nextTier.name);
  }

  /**
   * Upgrade to specific plan
   */
  upgradeToPlan(planId: string, planName: string): void {
    this.confirmUpgrade(planId, planName);
  }

  /**
   * Confirm and execute upgrade
   */
  private confirmUpgrade(planId: string, planName: string): void {
    if (!confirm(`Upgrade to ${planName} plan?\n\nThis will immediately update your account limits.`)) {
      return;
    }

    this.upgradingPlan = true;
    this.subscriptionService.upgradePlan(planId).subscribe({
      next: (response) => {
        if (response.success) {
          this.notificationService.success(
            'Plan Upgraded!',
            `Successfully upgraded to ${planName} plan.`
          );
          
          // Refresh subscription limits
          this.loadSubscriptionLimits();
          
          // Close modal if open
          this.closePlansModal();
        }
        this.upgradingPlan = false;
      },
      error: (error) => {
        console.error('Error upgrading plan:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to upgrade plan';
        this.notificationService.error(
          'Upgrade Failed',
          errorMessage
        );
        this.upgradingPlan = false;
      }
    });
  }

  /**
   * Get plan tier keys as array
   */
  getPlanKeys(): string[] {
    if (!this.allPlans) return [];
    return Object.keys(this.allPlans);
  }

  /**
   * Format price display
   */
  formatPrice(price: number | string): string {
    if (price === 'custom') return 'Custom';
    if (typeof price === 'number') return `$${price}/mo`;
    return price;
  }

  /**
   * Format feature name (replace underscores with spaces and title case)
   */
  formatFeatureName(feature: string): string {
    return feature
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get AI credits usage percentage
   */
  getAICreditsPercentage(): number {
    if (!this.subscriptionLimits) return 0;
    
    const current = this.subscriptionLimits.usage.aiCreditsThisMonth || 0;
    const max = this.subscriptionLimits.limits.maxAICreditsPerMonth;

    if (max === -1) return 0; // Unlimited
    if (max === 0) return 100;
    
    return Math.min(100, (current / max) * 100);
  }

  /**
   * Navigate to dedicated plans page
   */
  goToPlansPage(): void {
    this.router.navigate(['/app/plans']);
  }

  /**
   * Component cleanup (Step 10)
   */
  ngOnDestroy(): void {
    this.platformConnectionService.stopPolling();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
