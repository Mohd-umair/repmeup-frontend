import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-google-callback',
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
export class GoogleCallbackComponent implements OnInit {
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const refreshToken = params['refreshToken'];
      const isNewUser = params['isNewUser'] === 'true';
      const status = params['status'];
      const message = params['message'];

      if (status === 'error') {
        this.error = message || 'Authentication failed';
        setTimeout(() => {
          this.router.navigate(['/auth/login'], {
            queryParams: { error: this.error }
          });
        }, 2000);
        return;
      }

      if (token) {
        // Save tokens
        localStorage.setItem('token', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        // Redirect to dashboard
        this.router.navigate(['/app/dashboard']);
      } else {
        // Error
        this.error = 'Authentication failed - no token received';
        setTimeout(() => {
          this.router.navigate(['/auth/login'], {
            queryParams: { error: this.error }
          });
        }, 2000);
      }
    });
  }
}
