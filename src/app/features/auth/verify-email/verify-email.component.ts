import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrls: ['../register/register.component.scss']
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = (this.route.snapshot.queryParamMap.get('token') || '').trim();
    if (!token) {
      this.loading = false;
      this.error = 'Missing verification link. Open the link from your email or request a new one from the sign-in page.';
      return;
    }

    this.authService
      .verifySignupEmail(token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success && res.data?.token) {
            void this.router.navigate(['/app/dashboard']);
          } else {
            this.error = res.error || 'Verification failed.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'This link is invalid or has expired.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
