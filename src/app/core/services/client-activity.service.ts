import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Sends SPA route changes to the API so operators can see in-app navigation in the admin Activity log.
 * Best-effort only; failures are ignored.
 */
@Injectable({ providedIn: 'root' })
export class ClientActivityService implements OnDestroy {
  private sub?: Subscription;
  private lastUrl = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private auth: AuthService
  ) {
    this.sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = e.urlAfterRedirects || e.url;
        if (!url || url === this.lastUrl) return;
        this.lastUrl = url;
        if (!this.auth.isAuthenticated()) return;
        this.http
          .post(
            `${environment.apiUrl}/users/me/activity`,
            {
              route: url,
              title: typeof document !== 'undefined' ? document.title : undefined,
              referrer: typeof document !== 'undefined' ? document.referrer : undefined
            },
            { observe: 'response' }
          )
          .subscribe({ error: () => undefined });
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
