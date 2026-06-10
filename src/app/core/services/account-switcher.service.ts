import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { IApiResponse } from '../models/api-response.model';

/** One organization the current user can act within (agency multi-account). */
export interface IOrgMembership {
  organizationId: string;
  name: string;
  slug: string | null;
  logo: string | null;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  isDefault: boolean;
  status: 'active' | 'invited' | 'suspended';
}

interface IMyOrgsResponse {
  memberships: IOrgMembership[];
  activeOrganizationId: string | null;
}

/**
 * AccountSwitcherService — drives the agency multi-account switcher.
 *
 * Holds the user's org memberships + the active org id, and switches the active
 * org by re-issuing a session token (reusing AuthService.handleGoogleCallback,
 * the same token-swap path used by Google OAuth + super-admin impersonation).
 * After a switch the whole app re-initialises (menus, entitlements, sidebar)
 * because currentUser$ re-emits.
 */
@Injectable({ providedIn: 'root' })
export class AccountSwitcherService {
  private readonly membershipsSubject = new BehaviorSubject<IOrgMembership[]>([]);
  private readonly activeOrgIdSubject = new BehaviorSubject<string | null>(null);

  /** Orgs the user can switch between. */
  readonly memberships$ = this.membershipsSubject.asObservable();
  /** The currently active org id. */
  readonly activeOrgId$ = this.activeOrgIdSubject.asObservable();
  /** True only when the user belongs to more than one org (controls switcher visibility). */
  readonly hasMultiple$ = this.memberships$.pipe(map((m) => m.length > 1));

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  get memberships(): IOrgMembership[] {
    return this.membershipsSubject.value;
  }
  get activeOrgId(): string | null {
    return this.activeOrgIdSubject.value;
  }

  /** Refresh the membership list (e.g. on app load or after an invite). */
  load(): Observable<IOrgMembership[]> {
    return this.api.get<IApiResponse<IMyOrgsResponse>>('/auth/my-organizations').pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.membershipsSubject.next(res.data.memberships || []);
          this.activeOrgIdSubject.next(res.data.activeOrganizationId);
        }
      }),
      map((res) => res.data?.memberships || [])
    );
  }

  /** Seed the list from a /me payload that already includes memberships. */
  setFromMe(memberships: IOrgMembership[] | undefined, activeOrganizationId: string | null | undefined): void {
    if (memberships) this.membershipsSubject.next(memberships);
    if (activeOrganizationId !== undefined) this.activeOrgIdSubject.next(activeOrganizationId ?? null);
  }

  /**
   * Switch the active organization. Returns an observable that completes after
   * the new session is loaded; the caller navigates the app.
   */
  switchTo(organizationId: string): Observable<boolean> {
    if (organizationId === this.activeOrgId) return of(false);

    return this.api
      .post<IApiResponse<{ token: string; refreshToken: string; organizationId: string }>>(
        '/auth/switch-organization',
        { organizationId }
      )
      .pipe(
        switchMap((res) => {
          if (!res.success || !res.data?.token) {
            throw new Error(res.error || 'Could not switch organization');
          }
          // Reuse the proven token-swap: saves tokens + reloads currentUser$,
          // which re-inits menus/entitlements/sidebar for the new org.
          return this.auth.handleGoogleCallback(res.data.token, res.data.refreshToken).pipe(
            tap(() => this.activeOrgIdSubject.next(organizationId)),
            map(() => true)
          );
        })
      );
  }

  /** Switch then hard-refresh the dashboard so all org-scoped state is rebuilt. */
  switchAndGo(organizationId: string): void {
    this.switchTo(organizationId).subscribe({
      next: (switched) => {
        if (switched) {
          // Reload to guarantee every org-scoped subject/cache is rebuilt cleanly.
          this.router.navigateByUrl('/app/dashboard').then(() => window.location.reload());
        }
      },
      error: () => { /* surfaced by the caller's toast/notification if desired */ }
    });
  }
}
