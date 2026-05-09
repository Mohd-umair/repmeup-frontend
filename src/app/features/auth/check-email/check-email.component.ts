import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-check-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './check-email.component.html',
  styleUrls: ['../register/register.component.scss']
})
export class CheckEmailComponent implements OnInit, OnDestroy {
  email = '';
  loading = false;
  message = '';
  error = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.email = (this.route.snapshot.queryParamMap.get('email') || '').trim();
  }

  resend(): void {
    if (!this.email || this.loading) return;
    this.loading = true;
    this.error = '';
    this.message = '';

    this.authService
      .resendVerificationEmail(this.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.message = res.data?.message || 'If your account needs verification, we sent a new link.';
          } else {
            this.error = res.error || 'Could not send email.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'Could not send email. Try again shortly.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
