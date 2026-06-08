import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Magic-link landing for demo prospects: `/demo-login?token=...`.
 * Exchanges the one-time token for a session and drops the prospect into the app.
 * Shows an "upgrade" message if the trial has already ended (UPGRADE_REQUIRED).
 */
@Component({
  selector: 'app-demo-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center min-h-screen bg-rep-black">
      <div class="text-center px-4 max-w-md">
        <ng-container *ngIf="!error">
          <div class="w-16 h-16 border-4 border-rep-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-300 text-lg">Setting up your demo…</p>
        </ng-container>

        <ng-container *ngIf="error">
          <div class="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-clock text-amber-400 text-2xl"></i>
          </div>
          <h1 class="text-rep-white text-xl font-bold mb-2">{{ upgradeRequired ? 'Your demo trial has ended' : 'Demo link issue' }}</h1>
          <p class="text-gray-400 mb-6">{{ error }}</p>
          <div class="flex items-center justify-center gap-3">
            <a *ngIf="upgradeRequired" routerLink="/app/plans"
              class="px-5 py-2.5 rounded-xl bg-rep-lime text-rep-black font-semibold hover:opacity-90">
              View plans
            </a>
            <a routerLink="/auth/login"
              class="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 font-medium hover:bg-gray-800">
              Go to sign in
            </a>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
  `]
})
export class DemoLoginComponent implements OnInit, OnDestroy {
  error = '';
  upgradeRequired = false;

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
        if (!token) {
          this.fail('This demo link is missing its token. Please request a new link.');
          return;
        }

        const sub = this.authService.demoLogin(token).subscribe({
          next: (res) => {
            if (res.success) {
              this.router.navigate(['/app/dashboard']);
            } else {
              this.fail(res.error || 'This demo link is invalid or has expired.');
            }
          },
          error: (err) => {
            const code = err?.error?.code;
            const message = err?.error?.error || 'This demo link is invalid or has expired.';
            this.upgradeRequired = code === 'UPGRADE_REQUIRED';
            this.error = message;
          }
        });
        this.pendingWork.add(sub);
      })
    );
  }

  private fail(message: string): void {
    this.error = message;
    this.pendingWork.add(
      timer(4000).pipe(take(1)).subscribe(() => this.router.navigate(['/auth/login']))
    );
  }

  ngOnDestroy(): void {
    this.pendingWork.unsubscribe();
  }
}
