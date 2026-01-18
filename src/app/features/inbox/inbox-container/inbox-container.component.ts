import { Component, OnInit, OnDestroy } from '@angular/core';
import { InboxService } from '../../../core/services/inbox.service';
import { PlatformService } from '../../../core/services/platform.service';
import { IInteraction, IInboxFilters } from '../../../core/models/interaction.model';
import { forkJoin, interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

/**
 * Inbox Container Component - Single Responsibility Principle
 * Manages the unified inbox with three-column layout
 */
@Component({
  selector: 'app-inbox-container',
  templateUrl: './inbox-container.component.html',
  styleUrls: ['./inbox-container.component.scss']
})
export class InboxContainerComponent implements OnInit, OnDestroy {
  interactions: IInteraction[] = [];
  selectedInteraction: IInteraction | null = null;
  filters: IInboxFilters = {};
  platformFilters: IInboxFilters = {};
  topFilters: IInboxFilters = {};
  loading = false;
  syncing = false;
  lastSyncTime: Date | null = null;
  autoSyncEnabled = true;
  private autoSyncSubscription?: Subscription;

  constructor(
    private inboxService: InboxService,
    private platformService: PlatformService
  ) {}

  ngOnInit(): void {
    this.loadInteractions();

    // Subscribe to interactions
    this.inboxService.interactions$.subscribe(interactions => {
      this.interactions = interactions;
    });

    // Subscribe to selected interaction
    this.inboxService.selectedInteraction$.subscribe(interaction => {
      this.selectedInteraction = interaction;
    });

    // Start auto-sync (every 5 minutes)
    this.startAutoSync();
  }

  ngOnDestroy(): void {
    // Clean up auto-sync subscription
    if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
    }
  }

  /**
   * Start auto-sync for platforms (every 5 minutes)
   */
  startAutoSync(): void {
    if (!this.autoSyncEnabled) {
      return;
    }

    // Sync every 5 minutes (300000 ms)
    this.autoSyncSubscription = interval(300000)
      .pipe(
        switchMap(() => this.syncAllPlatforms(true))
      )
      .subscribe({
        next: () => {
          console.log('Auto-sync completed');
        },
        error: (error) => {
          console.error('Auto-sync error:', error);
        }
      });
  }

  /**
   * Toggle auto-sync on/off
   */
  toggleAutoSync(): void {
    this.autoSyncEnabled = !this.autoSyncEnabled;
    
    if (this.autoSyncEnabled) {
      this.startAutoSync();
    } else if (this.autoSyncSubscription) {
      this.autoSyncSubscription.unsubscribe();
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
              alert('No connected platforms to sync');
            }
            resolve();
            return;
          }

          // Sync all platforms in parallel
          const syncObservables = connectedPlatforms.map((platform: any) =>
            this.platformService.syncPlatform(platform._id)
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
                alert(`Successfully synced ${successCount} of ${connectedPlatforms.length} platforms`);
              }
              resolve();
            },
            error: (error) => {
              console.error('Error syncing platforms:', error);
              if (!silent) {
                this.syncing = false;
                alert('Error syncing some platforms. Check console for details.');
              }
              reject(error);
            }
          });
        },
        error: (error) => {
          console.error('Error fetching platforms:', error);
          if (!silent) {
            this.syncing = false;
            alert('Error fetching platform connections');
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
    // Merge filters from both sources
    this.filters = { ...this.platformFilters, ...this.topFilters };
    this.inboxService.getInteractions(this.filters).subscribe({
      next: () => {
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onPlatformFilterChange(filters: IInboxFilters): void {
    this.platformFilters = filters;
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
}
