import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { PlatformConnection, PlatformConnectionService } from './platform-connection.service';

const STORAGE_PREFIX = 'repmeup:selectedConnection:';

/** Statuses aligned with backend inbox connection scope. */
const ACTIVE_CONNECTION_STATUSES = new Set(['connected', 'available', 'error', 'token_expired']);

/**
 * Global selected connected-account context (header account switcher).
 * null = All accounts.
 */
@Injectable({
  providedIn: 'root'
})
export class AccountContextService implements OnDestroy {
  private readonly selectedSubject = new BehaviorSubject<PlatformConnection | null>(null);
  readonly selectedConnection$ = this.selectedSubject.asObservable();

  private subscriptions: Subscription[] = [];
  private currentOrgId: string | null = null;
  private latestConnections: PlatformConnection[] = [];

  constructor(
    private authService: AuthService,
    private platformConnectionService: PlatformConnectionService
  ) {
    this.subscriptions.push(
      combineLatest([
        this.authService.currentUser$.pipe(
          map((user) => {
            const org = user?.organization;
            if (!org) return null;
            return typeof org === 'object' ? org._id : String(org);
          })
        ),
        this.platformConnectionService.connections$
      ]).subscribe(([orgId, connections]) => {
        this.currentOrgId = orgId;
        this.latestConnections = connections ?? [];
        if (!orgId) {
          this.selectedSubject.next(null);
          return;
        }
        this.syncSelectionWithConnections(orgId, this.latestConnections);
      })
    );

    this.platformConnectionService.getConnections().subscribe({ error: () => undefined });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  /** Selected connection id for API filters; undefined when viewing all accounts. */
  get selectedConnectionId(): string | undefined {
    return this.selectedSubject.value?._id;
  }

  get selectedConnection(): PlatformConnection | null {
    return this.selectedSubject.value;
  }

  /** Active connections eligible for the switcher. */
  getActiveConnections(connections: PlatformConnection[] = this.latestConnections): PlatformConnection[] {
    return connections.filter(
      (c) => c.isActive !== false && ACTIVE_CONNECTION_STATUSES.has(c.status)
    );
  }

  selectConnection(connection: PlatformConnection | null): void {
    const orgId = this.currentOrgId;
    if (!orgId) return;

    if (connection) {
      const allowed = this.getActiveConnections().some((c) => c._id === connection._id);
      if (!allowed) return;
    }

    this.persistSelection(orgId, connection?._id ?? null);
    this.selectedSubject.next(connection);
  }

  selectAllAccounts(): void {
    this.selectConnection(null);
  }

  private syncSelectionWithConnections(orgId: string, connections: PlatformConnection[]): void {
    const active = this.getActiveConnections(connections);
    const storedId = this.readStoredId(orgId);

    if (!storedId) {
      if (this.selectedSubject.value !== null) {
        this.selectedSubject.next(null);
      }
      return;
    }

    const match = active.find((c) => c._id === storedId);
    if (!match) {
      this.persistSelection(orgId, null);
      this.selectedSubject.next(null);
      return;
    }

    if (this.selectedSubject.value?._id !== match._id) {
      this.selectedSubject.next(match);
    }
  }

  private storageKey(orgId: string): string {
    return `${STORAGE_PREFIX}${orgId}`;
  }

  private readStoredId(orgId: string): string | null {
    try {
      return localStorage.getItem(this.storageKey(orgId));
    } catch {
      return null;
    }
  }

  private persistSelection(orgId: string, connectionId: string | null): void {
    try {
      const key = this.storageKey(orgId);
      if (connectionId) {
        localStorage.setItem(key, connectionId);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore quota / private mode
    }
  }
}
