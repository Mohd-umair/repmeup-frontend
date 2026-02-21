import { Component, OnInit, OnDestroy, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InboxService } from '../../../core/services/inbox.service';
import { PlatformService } from '../../../core/services/platform.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserService, IAvailableAgent } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { IInteraction, IInboxFilters, InboxViewMode, ILabel } from '../../../core/models/interaction.model';
import { InboxDetailComponent } from '../inbox-detail/inbox-detail.component';
import { InboxFiltersComponent } from '../inbox-filters/inbox-filters.component';
import { InboxListComponent } from '../inbox-list/inbox-list.component';
import { InboxTopFiltersComponent } from '../inbox-top-filters/inbox-top-filters.component';
import { InboxActionsComponent } from '../inbox-actions/inbox-actions.component';
import { OrganizationService } from '../../../core/services/organization.service';
import { forkJoin, timer, Subscription, of, from } from 'rxjs';
import { exhaustMap, catchError } from 'rxjs/operators';

/**
 * Inbox Container Component - Single Responsibility Principle
 * Manages the unified inbox with three-column layout
 */
@Component({
  selector: 'app-inbox-container',
  standalone: true,
  imports: [CommonModule, FormsModule, InboxDetailComponent, InboxFiltersComponent, InboxListComponent, InboxTopFiltersComponent, InboxActionsComponent],
  templateUrl: './inbox-container.component.html',
  styleUrls: ['./inbox-container.component.scss']
})
export class InboxContainerComponent implements OnInit, OnDestroy {
  interactions: IInteraction[] = [];
  selectedInteraction: IInteraction | null = null;
  filters: IInboxFilters = {};
  platformFilters: IInboxFilters = {};
  topFilters: IInboxFilters = {};
  viewMode: InboxViewMode = 'all';
  loading = false;
  syncing = false;
  analyzingSentiment = false;
  lastSyncTime: Date | null = null;
  autoSyncEnabled = true;
  showStats = false; // Stats are hidden by default for cleaner UI
  showFilters = true; // Filters are shown by default, but can be collapsed
  inboxStats: { 
    responseRate?: number;
    priorityCount?: number;
    overdueCount?: number;
  } | null = null;
  showShortcutsOverlay = false;
  showMoreOptions = false;      // Header more options dropdown
  showBulkMoreActions = false;  // Bulk assign dropdown
  showBulkLabelActions = false; // Bulk label dropdown
  assignDropdownPos: { top: number; left: number } | null = null;
  labelDropdownPos: { top: number; left: number } | null = null;
  selectedIds = new Set<string>();
  bulkProcessing = false;
  availableAgents: IAvailableAgent[] = [];
  bulkAssignAgentId = '';
  orgLabels: ILabel[] = [];
  bulkLabelId = '';
  @ViewChild(InboxDetailComponent) inboxDetail?: InboxDetailComponent;
  private autoSyncSubscription?: Subscription;
  private subscriptions: Subscription[] = [];

  constructor(
    private inboxService: InboxService,
    private platformService: PlatformService,
    private notificationService: NotificationService,
    private sweetAlertService: SweetAlertService,
    private themeService: ThemeService,
    private userService: UserService,
    private authService: AuthService,
    private organizationService: OrganizationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Don't select any conversation by default
    this.selectedInteraction = null;
    
    // Reset theme to default (light black/gray) when entering inbox
    this.themeService.resetTheme();
    
    // Apply theme based on current platform filter if exists
    if (this.platformFilters.platform) {
      this.themeService.setPlatformTheme(this.platformFilters.platform);
    }
    
    // Apply initial filters from route query params (e.g. ?sentiment=negative, ?status=unread, ?overdue=true)
    const params = this.route.snapshot.queryParams;
    if (params['sentiment']) {
      this.topFilters = { ...this.topFilters, sentiment: params['sentiment'] as any };
    }
    if (params['status']) {
      this.topFilters = { ...this.topFilters, status: params['status'] as any };
    }
    if (params['overdue'] === 'true' || params['overdue'] === '1') {
      this.viewMode = 'overdue';
    }

    // Load saved auto-sync preference from the organisation
    this.loadAutoSyncSetting();

    this.loadInteractions();
    this.loadInboxStats();

    // Subscribe to interactions (must unsubscribe on destroy to avoid memory leak)
    this.subscriptions.push(
      this.inboxService.interactions$.subscribe(interactions => {
        this.interactions = this.applyViewModeSort(interactions);
      })
    );

    // Subscribe to selected interaction
    this.subscriptions.push(
      this.inboxService.selectedInteraction$.subscribe(interaction => {
        this.selectedInteraction = interaction;
      })
    );

    // Load agents for bulk assign (admin/manager only)
    if (this.canAssign()) {
      this.userService.getAvailableAgents().subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.availableAgents = res.data;
            console.log('Available agents loaded:', this.availableAgents.length);
          }
        },
        error: (err) => {
          console.error('Failed to load agents:', err);
          this.notificationService.error('Failed to load agents', 'Could not load available agents for assignment');
        }
      });
    }

    // Load labels for bulk add
    this.inboxService.getLabels().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.orgLabels = res.data;
          console.log('Labels loaded:', this.orgLabels.length);
        }
      },
      error: (err) => {
        console.error('Failed to load labels:', err);
      }
    });
  }

  onSelectionChange(next: Set<string>): void {
    this.selectedIds = next;
  }

  clearBulkSelection(): void {
    this.selectedIds = new Set();
    this.showBulkMoreActions = false;
    this.showBulkLabelActions = false;
    this.assignDropdownPos = null;
    this.labelDropdownPos = null;
  }

  /** Open assign dropdown with fixed positioning (escapes overflow clipping) */
  toggleAssignDropdown(ev?: Event): void {
    this.showBulkLabelActions = false;
    this.labelDropdownPos = null;
    if (this.showBulkMoreActions) {
      this.showBulkMoreActions = false;
      this.assignDropdownPos = null;
      return;
    }
    this.showBulkMoreActions = true;
    const btn = (ev?.currentTarget ?? ev?.target) as HTMLElement;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      this.assignDropdownPos = { top: rect.bottom + 6, left: rect.left };
    } else {
      this.assignDropdownPos = { top: 120, left: 24 };
    }
    setTimeout(() => this.attachDropdownCloseListener(), 0);
  }

  /** Open label dropdown with fixed positioning (escapes overflow clipping) */
  toggleLabelDropdown(ev?: Event): void {
    this.showBulkMoreActions = false;
    this.assignDropdownPos = null;
    if (this.showBulkLabelActions) {
      this.showBulkLabelActions = false;
      this.labelDropdownPos = null;
      return;
    }
    this.showBulkLabelActions = true;
    const btn = (ev?.currentTarget ?? ev?.target) as HTMLElement;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      this.labelDropdownPos = { top: rect.bottom + 6, left: rect.left };
    } else {
      this.labelDropdownPos = { top: 120, left: 24 };
    }
    setTimeout(() => this.attachDropdownCloseListener(), 0);
  }

  private dropdownCloseHandler = (): void => {
    this.showBulkMoreActions = false;
    this.showBulkLabelActions = false;
    this.assignDropdownPos = null;
    this.labelDropdownPos = null;
    document.removeEventListener('click', this.dropdownCloseHandler);
  };

  private attachDropdownCloseListener(): void {
    document.removeEventListener('click', this.dropdownCloseHandler);
    setTimeout(() => document.addEventListener('click', this.dropdownCloseHandler), 0);
  }

  selectAllOnPage(): void {
    this.selectedIds = new Set(this.interactions.map(i => i._id));
  }

  bulkMarkAsRead(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.updateStatusBulk(ids, 'read').subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Bulk update', `Marked ${(res as any).data?.updated || ids.length} as read`);
          this.clearBulkSelection();
          this.loadInteractions();
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  bulkResolve(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to resolve');
      return;
    }

    this.sweetAlertService.confirm(
      'Mark as Resolved?',
      `Are you sure you want to mark ${ids.length} conversation(s) as resolved?`,
      'Yes, Resolve',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Resolving...', 'Please wait while we resolve the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'resolved').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Resolved ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions();
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to resolve conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  bulkAssign(): void {
    if (!this.bulkAssignAgentId) return;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.assignBulk(ids, this.bulkAssignAgentId).subscribe({
      next: (res) => {
        if (res.success) {
          const count = (res as any).data?.updated || ids.length;
          const agent = this.availableAgents.find(a => a._id === this.bulkAssignAgentId);
          const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'agent';
          this.notificationService.success('Assigned', `${count} conversation(s) assigned to ${agentName}`);
          this.clearBulkSelection();
          this.bulkAssignAgentId = '';
          this.loadInteractions();
          // Refresh agent workload counts
          this.refreshAgentWorkloads();
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  /** Assign directly from dropdown — avoids two-step property set + call */
  assignToAgent(agentId: string): void {
    this.bulkAssignAgentId = agentId;
    this.showBulkMoreActions = false;
    this.assignDropdownPos = null;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.assignBulk(ids, agentId).subscribe({
      next: (res) => {
        if (res.success) {
          const count = (res as any).data?.updated || ids.length;
          const agent = this.availableAgents.find(a => a._id === agentId);
          const agentName = agent ? `${agent.firstName} ${agent.lastName}` : 'agent';
          this.notificationService.success('Assigned', `${count} conversation(s) assigned to ${agentName}`);
          this.clearBulkSelection();
          this.bulkAssignAgentId = '';
          this.loadInteractions();
          this.refreshAgentWorkloads();
          // Re-fetch the open detail panel so the "Assigned to…" banner appears immediately
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  refreshAgentWorkloads(): void {
    if (!this.canAssign()) return;
    this.userService.getAvailableAgents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.availableAgents = res.data;
        }
      }
    });
  }

  canAssign(): boolean {
    const user = this.authService.currentUserValue;
    return !!(user && (user.role === 'admin' || user.role === 'manager'));
  }

  bulkAddLabel(): void {
    if (!this.bulkLabelId) return;
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) return;
    this.bulkProcessing = true;
    this.inboxService.addLabelBulk(ids, this.bulkLabelId).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Bulk label', `Added label to ${(res as any).data?.updated || ids.length} conversation(s)`);
          this.clearBulkSelection();
          this.bulkLabelId = '';
          this.loadInteractions();
          this.refreshSelectedIfAffected(ids);
        }
        this.bulkProcessing = false;
      },
      error: () => { this.bulkProcessing = false; }
    });
  }

  bulkArchive(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to archive');
      return;
    }

    this.sweetAlertService.confirm(
      'Archive Conversations?',
      `Are you sure you want to archive ${ids.length} conversation(s)?`,
      'Yes, Archive',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Archiving...', 'Please wait while we archive the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'archived').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Archived ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions();
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to archive conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  bulkUnarchive(): void {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0) {
      this.sweetAlertService.warning('No Selection', 'Please select conversations to unarchive');
      return;
    }

    this.sweetAlertService.confirm(
      'Unarchive Conversations?',
      `Are you sure you want to unarchive ${ids.length} conversation(s)?`,
      'Yes, Unarchive',
      'Cancel'
    ).then((result) => {
      if (result.isConfirmed) {
        this.bulkProcessing = true;
        this.sweetAlertService.showLoading('Unarchiving...', 'Please wait while we unarchive the conversations');
        
        this.inboxService.updateStatusBulk(ids, 'unread').subscribe({
          next: (res) => {
            this.sweetAlertService.close();
            if (res.success) {
              const updatedCount = (res as any).data?.updated || ids.length;
              this.sweetAlertService.success(
                'Success!',
                `Unarchived ${updatedCount} conversation(s)`
              );
              this.clearBulkSelection();
              this.loadInteractions();
              this.refreshSelectedIfAffected(ids);
            }
            this.bulkProcessing = false;
          },
          error: (err) => {
            this.sweetAlertService.close();
            this.sweetAlertService.error(
              'Error',
              err?.error?.message || 'Failed to unarchive conversations'
            );
            this.bulkProcessing = false;
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.dropdownCloseHandler);
    if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.themeService.resetTheme();
  }

  /**
   * Get platform-specific icon for the header
   */
  getHeaderIcon(): string {
    // If in archived view, show archive icon
    if (this.viewMode === 'archived') {
      return 'fas fa-archive';
    }
    
    if (!this.platformFilters.platform) {
      return 'fas fa-inbox'; // Default unified inbox icon
    }

    const platformIcons: { [key: string]: string } = {
      'instagram': 'fab fa-instagram',
      'facebook': 'fab fa-facebook-f',
      'youtube': 'fab fa-youtube',
      'google': 'fab fa-google',
      'linkedin': 'fab fa-linkedin-in',
      'whatsapp': 'fab fa-whatsapp',
      'website': 'fas fa-globe'
    };

    return platformIcons[this.platformFilters.platform.toLowerCase()] || 'fas fa-inbox';
  }

  /**
   * Get platform-specific title for the header
   */
  getHeaderTitle(): string {
    // If in archived view, show archived title
    if (this.viewMode === 'archived') {
      return 'Archived Conversations';
    }
    
    if (!this.platformFilters.platform) {
      return 'Unified Inbox';
    }

    // Capitalize first letter of platform name
    const platformName = this.platformFilters.platform.charAt(0).toUpperCase() + 
                         this.platformFilters.platform.slice(1);
    return `${platformName} Inbox`;
  }

  /**
   * Get platform-specific subtitle for the header
   */
  getHeaderSubtitle(): string {
    if (!this.platformFilters.platform) {
      return 'Manage all your interactions in one place';
    }

    const platformSubtitles: { [key: string]: string } = {
      'instagram': 'Manage your Instagram comments and messages',
      'facebook': 'Manage your Facebook posts and comments',
      'youtube': 'Manage your YouTube comments',
      'google': 'Manage your Google Business reviews',
      'linkedin': 'Manage your LinkedIn posts and comments',
      'whatsapp': 'Manage your WhatsApp conversations',
      'website': 'Manage your website interactions'
    };

    return platformSubtitles[this.platformFilters.platform.toLowerCase()] || 
           `Manage your ${this.platformFilters.platform} interactions`;
  }

  /**
   * Start auto-sync for platforms (every 5 minutes)
   * Uses timer(0, 300000) to run immediately on start, then every 5 min
   */
  startAutoSync(): void {
    if (!this.autoSyncEnabled) {
      return;
    }

    // Unsubscribe any existing auto-sync before starting new one
    if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
      this.autoSyncSubscription = undefined;
    }

    // Sync immediately, then every 5 minutes (300000 ms).
    // exhaustMap: if a sync is still running when the timer fires, skip that tick.
    // catchError inside exhaustMap: errors are scoped to one iteration so they
    // never complete the outer timer Observable.
    this.autoSyncSubscription = timer(0, 300000)
      .pipe(
        exhaustMap(() =>
          from(this.syncAllPlatforms(true)).pipe(
            catchError((err) => {
              console.error('Auto-sync error:', err);
              return of(null);
            })
          )
        )
      )
      .subscribe({
        next: () => {
          if (this.autoSyncEnabled) {
            this.lastSyncTime = new Date();
          }
        }
      });
  }

  /** Get the current organisation ID from the authenticated user */
  private getOrgId(): string | null {
    const user = this.authService.currentUserValue;
    if (!user) return null;
    return typeof user.organization === 'string'
      ? user.organization
      : (user.organization as any)?._id ?? null;
  }

  /** Load the saved auto-sync preference from the backend */
  private loadAutoSyncSetting(): void {
    const orgId = this.getOrgId();
    if (!orgId) return;
    this.organizationService.getOrganization(orgId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Default to true if the field hasn't been set yet
          const saved = res.data.inboxSettings?.autoSyncEnabled;
          this.autoSyncEnabled = saved !== false;
          if (this.autoSyncEnabled) {
            this.startAutoSync();
          }
        }
      },
      error: () => {
        // If we can't reach the backend, keep the default (true) and start sync
        this.startAutoSync();
      }
    });
  }

  /** Persist the auto-sync preference to the backend */
  private saveAutoSyncSetting(enabled: boolean): void {
    const orgId = this.getOrgId();
    if (!orgId) return;
    this.organizationService.updateInboxSettings(orgId, { autoSyncEnabled: enabled }).subscribe({
      error: (err) => console.error('Failed to save auto-sync preference:', err)
    });
  }

  /**
   * Toggle auto-sync on/off.
   * Turning OFF shows a confirmation dialog and persists the choice to the backend.
   * Turning ON starts the sync immediately and persists.
   */
  toggleAutoSync(): void {
    if (this.autoSyncEnabled) {
      // Currently ON → ask the user to confirm turning it OFF
      this.sweetAlertService.confirm(
        'Turn Off Auto-Sync?',
        'Automatic syncing will stop. Your inbox won\'t receive new messages until you turn it back on or refresh manually.',
        'Yes, Turn Off',
        'Cancel'
      ).then((result) => {
        if (result.isConfirmed) {
          this.autoSyncEnabled = false;
          if (this.autoSyncSubscription) {
            this.autoSyncSubscription.unsubscribe();
            this.autoSyncSubscription = undefined;
          }
          this.saveAutoSyncSetting(false);
          this.notificationService.info('Auto-Sync Disabled', 'Your inbox will no longer sync automatically.');
        }
      });
    } else {
      // Currently OFF → turn it back on immediately
      this.autoSyncEnabled = true;
      this.startAutoSync();
      this.saveAutoSyncSetting(true);
      this.notificationService.success('Auto-Sync Enabled', 'Your inbox will sync automatically every 5 minutes.');
    }
  }

  /**
   * Manually sync all connected platforms
   */
  syncAllPlatforms(silent = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!silent) {
        this.syncing = true;
      }

      // First, get all connected platforms
      this.platformService.getPlatformConnections().subscribe({
        next: (response) => {
          const connectedPlatforms = response.data.filter(
            (p: any) => p.status === 'connected' && p.isActive
          );

          if (connectedPlatforms.length === 0) {
            if (!silent) {
              this.syncing = false;
              this.notificationService.warning('No Platforms Connected', 'Please connect at least one platform to sync interactions.');
            }
            resolve();
            return;
          }

          // Sync all platforms in parallel with error handling
          // Use silent variant for background auto-sync to avoid loader flicker
          const syncObservables = connectedPlatforms.map((platform: any) =>
            (silent ? this.platformService.syncPlatformSilent(platform._id) : this.platformService.syncPlatform(platform._id)).pipe(
              // Catch errors for individual platforms so one failure doesn't break all
              catchError((error) => {
                console.error(`Error syncing ${platform.platform}:`, error);
                // Return a failed result instead of throwing
                return of({
                  success: false,
                  platform: platform.platform,
                  error: error.error?.error || error.message || 'Unknown error',
                  data: { interactionsAdded: 0 }
                });
              })
            )
          );

          forkJoin(syncObservables).subscribe({
            next: (results) => {
              console.log('All platforms synced:', results);
              this.lastSyncTime = new Date();
              
              // Reload interactions after sync
              this.loadInteractions();
              
              if (!silent) {
                this.syncing = false;
                const successCount = results.filter((r: any) => r.success).length;
                const failedCount = results.filter((r: any) => !r.success).length;
                const totalInteractions = results.reduce((sum: number, r: any) => sum + (r.data?.interactionsAdded || 0), 0);
                
                if (failedCount === 0) {
                  this.notificationService.success(
                    'Sync Completed Successfully',
                    `Synced ${successCount} platform(s) and found ${totalInteractions} new interactions.`
                  );
                } else {
                  const failedPlatforms = results
                    .filter((r: any) => !r.success)
                    .map((r: any) => `${r.platform || 'Unknown'}: ${r.error || 'Failed'}`);
                  
                  this.notificationService.showWithDetails(
                    'warning',
                    'Partial Sync Success',
                    `Synced ${successCount} of ${connectedPlatforms.length} platforms. Found ${totalInteractions} new interactions.`,
                    failedPlatforms,
                    10000
                  );
                }
              }
              resolve();
            },
            error: (error) => {
              console.error('Error syncing platforms:', error);
              if (!silent) {
                this.syncing = false;
                const errorMessage = error.error?.error || error.message || 'Unknown error';
                this.notificationService.error(
                  'Sync Failed',
                  `${errorMessage}. Check browser console for details.`,
                  8000
                );
              }
              reject(error);
            }
          });
        },
        error: (error) => {
          console.error('Error fetching platforms:', error);
          if (!silent) {
            this.syncing = false;
            this.notificationService.error(
              'Failed to Fetch Platforms',
              'Could not retrieve platform connections. Please try again.'
            );
          }
          reject(error);
        }
      });
    });
  }

  /**
   * Manual sync trigger
   */
  onSyncClick(): void {
    this.syncAllPlatforms(false);
  }

  loadInteractions(): void {
    this.loading = true;
    // Merge filters: viewMode affects assignedTo and status/sort
    // Clean undefined values to prevent wrong cache keys
    const mergedFilters = {
      ...this.platformFilters,
      ...this.topFilters,
      viewMode: this.viewMode === 'all' ? undefined : this.viewMode,
      // Pass status from topFilters unless we're in archived view
      status: this.topFilters.status || undefined
    };
    
    // Remove undefined/null/empty values from filters
    this.filters = Object.fromEntries(
      Object.entries(mergedFilters).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ) as IInboxFilters;
    
    this.inboxService.getInteractions(this.filters).subscribe({
      next: () => {
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
    this.loadInboxStats();
  }

  setViewMode(mode: InboxViewMode): void {
    this.viewMode = mode;
    this.loadInteractions();
  }

  /**
   * Apply priority sort on frontend (unread first, negative sentiment, then by date)
   */
  private applyViewModeSort(interactions: IInteraction[]): IInteraction[] {
    if (this.viewMode !== 'priority' || interactions.length === 0) {
      return interactions;
    }
    return [...interactions].sort((a, b) => {
      const score = (i: IInteraction) => {
        let s = 0;
        if (i.status === 'unread' && i.sentiment === 'negative') return 300;
        if (i.status === 'unread') return 200;
        if (i.sentiment === 'negative') return 100;
        return 0;
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      const dateA = new Date(a.platformCreatedAt).getTime();
      const dateB = new Date(b.platformCreatedAt).getTime();
      return dateB - dateA;
    });
  }

  loadInboxStats(): void {
    const filters = this.platformFilters.platform ? { platform: this.platformFilters.platform } : undefined;
    this.inboxService.getStats(filters).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.inboxStats = response.data;
        }
      }
    });
  }

  onPlatformFilterChange(filters: IInboxFilters): void {
    this.platformFilters = filters;
    
    // Clear selected interaction when switching platforms
    this.selectedInteraction = null;
    
    // Apply platform theme when platform filter is selected
    if (filters.platform) {
      this.themeService.setPlatformTheme(filters.platform);
    } else {
      this.themeService.resetTheme();
    }
    
    this.loadInteractions();
  }

  onTopFilterChange(filters: IInboxFilters): void {
    this.topFilters = filters;
    this.loadInteractions();
  }

  onFilterChange(filters: IInboxFilters): void {
    // Legacy support - merge with existing filters
    this.filters = { ...this.filters, ...filters };
    this.loadInteractions();
  }

  onSearchChange(searchTerm: string): void {
    // Update search filter
    if (searchTerm && searchTerm.trim()) {
      this.topFilters = { ...this.topFilters, search: searchTerm.trim() };
    } else {
      // Remove search filter if empty
      const { search, ...rest } = this.topFilters;
      this.topFilters = rest;
    }
    this.loadInteractions();
  }

  onInteractionSelect(interaction: IInteraction): void {
    // Fetch full interaction details (this will also mark it as read on the backend)
    this.inboxService.getInteraction(interaction._id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Update the selected interaction with the full details
          this.inboxService.setSelectedInteraction(response.data);
          
          // Update the interaction in the local list if status changed
          const index = this.interactions.findIndex(i => i._id === interaction._id);
          if (index !== -1 && response.data.status !== this.interactions[index].status) {
            this.interactions[index] = response.data;
            // The service will sync on next refresh, local update is sufficient for UI
          }
        }
      },
      error: (error) => {
        console.error('Error fetching interaction details:', error);
        // Fallback to setting the interaction without fetching
    this.inboxService.setSelectedInteraction(interaction);
      }
    });
  }

  onInteractionUpdate(): void {
    this.loadInteractions();

    // Re-fetch the open conversation so new replies appear immediately
    if (this.selectedInteraction?._id) {
      this.inboxService.getInteraction(this.selectedInteraction._id).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.inboxService.setSelectedInteraction(res.data);
          }
        }
      });
    }
  }

  /**
   * After bulk operations that mutate interaction data (assign, label, archive…),
   * re-fetch the currently open detail panel so banners / metadata refresh instantly.
   */
  private refreshSelectedIfAffected(ids: string[]): void {
    if (!this.selectedInteraction) return;
    if (!ids.includes(this.selectedInteraction._id)) return;
    this.inboxService.getInteraction(this.selectedInteraction._id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.inboxService.setSelectedInteraction(res.data);
          // Also update the item in the local list so the sidebar stays in sync
          const idx = this.interactions.findIndex(i => i._id === res.data!._id);
          if (idx !== -1) { this.interactions[idx] = res.data!; }
        }
      }
    });
  }

  getUnreadCount(): number {
    return this.interactions.filter(i => i.status === 'unread').length;
  }

  getTodayCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.interactions.filter(i => {
      const interactionDate = new Date(i.platformCreatedAt);
      interactionDate.setHours(0, 0, 0, 0);
      return interactionDate.getTime() === today.getTime();
    }).length;
  }

  /**
   * Keyboard shortcuts: J/K navigate, R focus reply, E resolve, ? show help
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore when typing in inputs, textareas, or contenteditable
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      if (event.key !== 'Escape') return;
      if (this.showShortcutsOverlay) {
        this.showShortcutsOverlay = false;
      }
      return;
    }

    switch (event.key) {
      case 'j':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.navigateNext();
        }
        break;
      case 'k':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.navigatePrev();
        }
        break;
      case 'r':
      case 'R':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          this.inboxDetail?.focusReplyBox();
        }
        break;
      case 'e':
      case 'E':
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          if (this.inboxDetail?.canResolve?.()) {
            this.inboxDetail?.resolveInteraction?.();
          }
        }
        break;
      case '?':
        event.preventDefault();
        this.showShortcutsOverlay = !this.showShortcutsOverlay;
        break;
      case 'Escape':
        this.showShortcutsOverlay = false;
        this.showMoreOptions = false;
        this.showBulkMoreActions = false;
        this.showBulkLabelActions = false;
        this.assignDropdownPos = null;
        this.labelDropdownPos = null;
        break;
    }
  }

  navigateNext(): void {
    if (this.interactions.length === 0) return;
    const idx = this.selectedInteraction
      ? this.interactions.findIndex(i => i._id === this.selectedInteraction!._id)
      : -1;
    const nextIdx = idx < 0 ? 0 : Math.min(idx + 1, this.interactions.length - 1);
    this.onInteractionSelect(this.interactions[nextIdx]);
  }

  navigatePrev(): void {
    if (this.interactions.length === 0) return;
    const idx = this.selectedInteraction
      ? this.interactions.findIndex(i => i._id === this.selectedInteraction!._id)
      : 0;
    const prevIdx = Math.max(0, idx - 1);
    this.onInteractionSelect(this.interactions[prevIdx]);
  }

  /**
   * Run sentiment analysis on comments that have no sentiment (so positive/negative/neutral filters work)
   */
  runAnalyzeSentiment(): void {
    this.analyzingSentiment = true;
    this.inboxService.analyzeSentiment(500).subscribe({
      next: (res) => {
        this.analyzingSentiment = false;
        if (res.success && res.data) {
          this.notificationService.success(
            'Sentiment Analyzed',
            res.data.message || `Analyzed ${res.data.analyzed} comment(s). Try the Positive / Negative / Neutral filters again.`
          );
          this.loadInteractions();
        }
      },
      error: () => {
        this.analyzingSentiment = false;
        this.notificationService.error('Analysis Failed', 'Could not analyze sentiment. Try again later.');
      }
    });
  }
}
