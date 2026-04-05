import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-google-callback',
  standalone: false,
  template: `
    <div class="flex items-center justify-center min-h-screen bg-rep-black">
      <div class="text-center">
        <div class="w-16 h-16 border-4 border-rep-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-400 text-lg">Completing sign in with Google...</p>
        <p *ngIf="error" class="text-red-500 mt-4">{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `]
})
export class GoogleCallbackComponent implements OnInit, OnDestroy {
  error = '';

  /** All async work from this route (query read + delayed navigations). */
  private readonly pendingWork = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.pendingWork.add(
      this.route.queryParams.pipe(take(1)).subscribe((params) => {
        const token = params['token'];
        const refreshToken = params['refreshToken'];
        const status = params['status'];
        const message = params['message'];

        if (status === 'error') {
          this.error = message || 'Authentication failed';
          this.pendingWork.add(
            timer(2000)
              .pipe(take(1))
              .subscribe(() => {
                this.router.navigate(['/auth/login'], {
                  queryParams: { error: this.error }
                });
              })
          );
          return;
        }

        if (token) {
          // handleGoogleCallback sets currentUser$ / isAuthenticated$ before dashboard loads.
          const sub = this.authService.handleGoogleCallback(token, refreshToken).subscribe({
            next: () => {
              this.router.navigate(['/app/dashboard']);
            },
            error: (err) => {
              console.error('Google callback - failed to load user:', err);
              this.error = 'Authentication failed — could not load user profile.';
              this.pendingWork.add(
                timer(2000)
                  .pipe(take(1))
                  .subscribe(() => {
                    this.authService.logout();
                  })
              );
            }
          });
          this.pendingWork.add(sub);
        } else {
          this.error = 'Authentication failed - no token received';
          this.pendingWork.add(
            timer(2000)
              .pipe(take(1))
              .subscribe(() => {
                this.router.navigate(['/auth/login'], {
                  queryParams: { error: this.error }
                });
              })
          );
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.pendingWork.unsubscribe();
  }
}
