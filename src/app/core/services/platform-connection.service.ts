import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { tap, map, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Platform Connection Service (Single Responsibility Principle)
 * Manages platform connections and usage limits
 * Step 10: Includes auto-refresh polling for real-time updates
 */

export interface PlatformConnectionUsage {
  current: number;
  max: number;
  remaining: number;
}

export interface PlatformConnectionLimits {
  maxPlatformConnections: number;
}

export interface PlatformConnection {
  _id: string;
  organization: string;
  platform: string;
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformProfilePicture?: string;
  platformEmail?: string;
  platformPageId?: string;
  status: 'connected' | 'disconnected' | 'error' | 'token_expired';
  isActive: boolean;
  lastSyncAt?: Date;
  platformData?: any;
  metadata?: { profilePicture?: string; [key: string]: any };
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformConnectionsResponse {
  success: boolean;
  data: PlatformConnection[];
  usage: PlatformConnectionUsage;
  limits: PlatformConnectionLimits;
}

@Injectable({
  providedIn: 'root'
})
export class PlatformConnectionService implements OnDestroy {
  // Observable state for reactive UI updates (Open/Closed: easy to extend)
  private connectionsSubject = new BehaviorSubject<PlatformConnection[]>([]);
  private usageSubject = new BehaviorSubject<PlatformConnectionUsage | null>(null);
  
  public connections$ = this.connectionsSubject.asObservable();
  public usage$ = this.usageSubject.asObservable();

  // Auto-refresh polling (Step 10)
  private pollingInterval = 30000; // 30 seconds
  private pollingSubscription: any;
  private isPollingEnabled = false;

  constructor(private apiService: ApiService) {}

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /**
   * Get all platform connections with usage/limits
   * @returns Observable with connections, usage, and limits
   */
  getConnections(): Observable<PlatformConnectionsResponse> {
    return this.apiService.get<PlatformConnectionsResponse>('/platforms').pipe(
      tap(response => {
        if (response.success) {
          // Update reactive state for components that subscribe
          this.connectionsSubject.next(response.data);
          this.usageSubject.next(response.usage);
        }
      })
    );
  }

  /**
   * Check if organization can add a new connection
   * @returns Observable<{canConnect: boolean, remaining: number}>
   */
  canAddConnection(): Observable<{canConnect: boolean, remaining: number, message?: string}> {
    return this.usage$.pipe(
      map(usage => {
        if (!usage) {
          return { canConnect: false, remaining: 0, message: 'Usage data not loaded' };
        }
        
        const canConnect = usage.remaining > 0;
        return {
          canConnect,
          remaining: usage.remaining,
          message: canConnect 
            ? `You can add ${usage.remaining} more account${usage.remaining > 1 ? 's' : ''}`
            : `Plan limit reached (${usage.current}/${usage.max}). Upgrade to add more.`
        };
      })
    );
  }

  /**
   * Get current usage info (synchronous from cached state)
   * @returns Current usage or null if not loaded
   */
  getCurrentUsage(): PlatformConnectionUsage | null {
    return this.usageSubject.value;
  }

  /**
   * Disconnect a platform connection
   * @param connectionId Connection ID to disconnect
   * @returns Observable with success status
   */
  disconnectConnection(connectionId: string): Observable<any> {
    return this.apiService.delete(`/platforms/${connectionId}`).pipe(
      tap(() => {
        // Optimistically update local state
        const currentConnections = this.connectionsSubject.value;
        const updatedConnections = currentConnections.filter(c => c._id !== connectionId);
        this.connectionsSubject.next(updatedConnections);

        // Update usage counter
        const currentUsage = this.usageSubject.value;
        if (currentUsage) {
          this.usageSubject.next({
            ...currentUsage,
            current: Math.max(0, currentUsage.current - 1),
            remaining: Math.min(currentUsage.max, currentUsage.remaining + 1)
          });
        }
      })
    );
  }

  /**
   * Sync a platform connection
   * @param connectionId Connection ID to sync
   * @returns Observable with sync result
   */
  syncConnection(connectionId: string): Observable<any> {
    return this.apiService.post(`/platforms/${connectionId}/sync`, {});
  }

  /**
   * Refresh Google Business Profile locations
   * @param connectionId Connection ID to refresh
   * @param options Optional accountId to skip Google accounts.list (quota workaround)
   * @returns Observable with refresh result
   */
  refreshGoogleLocations(
    connectionId: string,
    options?: { accountId?: string }
  ): Observable<any> {
    const body = options?.accountId ? { accountId: options.accountId } : {};
    return this.apiService.post(`/platforms/${connectionId}/refresh-locations`, body);
  }

  /**
   * Refresh connections (reload from API)
   * Use after connecting/disconnecting to ensure state is accurate
   */
  refresh(): Observable<PlatformConnectionsResponse> {
    return this.getConnections();
  }

  /**
   * Get connections grouped by platform
   * @returns Observable with grouped connections
   */
  getConnectionsGroupedByPlatform(): Observable<Map<string, PlatformConnection[]>> {
    return this.connections$.pipe(
      map(connections => {
        const grouped = new Map<string, PlatformConnection[]>();
        connections.forEach(conn => {
          if (!grouped.has(conn.platform)) {
            grouped.set(conn.platform, []);
          }
          grouped.get(conn.platform)!.push(conn);
        });
        return grouped;
      })
    );
  }

  // ========== Real-time Updates (Step 10) ==========

  /**
   * Start auto-refresh polling
   * Automatically fetches latest connections every 30 seconds
   */
  startPolling(): void {
    if (this.isPollingEnabled) {
      console.log('⏱️ [Platform Connection Service] Polling already active');
      return;
    }

    console.log('⏱️ [Platform Connection Service] Starting auto-refresh polling (30s interval)');
    this.isPollingEnabled = true;

    // Poll every 30 seconds
    this.pollingSubscription = interval(this.pollingInterval)
      .pipe(
        switchMap(() => {
          console.log('⏱️ [Platform Connection Service] Auto-refreshing connections...');
          return this.apiService.get<PlatformConnectionsResponse>('/platforms');
        }),
        tap((response) => {
          if (response.success && response.data) {
            this.connectionsSubject.next(response.data);
            this.usageSubject.next(response.usage);
          }
        }),
        catchError((error) => {
          console.error('❌ [Platform Connection Service] Auto-refresh failed:', error);
          // Don't stop polling on error, just skip this cycle
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Stop auto-refresh polling
   */
  stopPolling(): void {
    if (this.pollingSubscription) {
      console.log('⏱️ [Platform Connection Service] Stopping auto-refresh polling');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
      this.isPollingEnabled = false;
    }
  }

  /**
   * Check if polling is active
   */
  isPollingActive(): boolean {
    return this.isPollingEnabled;
  }

  /**
   * Set polling interval (in milliseconds)
   */
  setPollingInterval(ms: number): void {
    if (ms < 5000) {
      console.warn('⚠️ [Platform Connection Service] Minimum polling interval is 5 seconds');
      ms = 5000;
    }
    
    this.pollingInterval = ms;
    
    // Restart polling if it was active
    if (this.isPollingEnabled) {
      this.stopPolling();
      this.startPolling();
    }
  }
}
