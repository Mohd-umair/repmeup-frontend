import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, Subscription, timer } from 'rxjs';
import { map, take, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

export type AuthMethod = 'email-otp' | 'email-password';
export type OtpStep = 'email' | 'code';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ─── Auth method selection ───────────────────────────────────────────────
  activeMethod: AuthMethod = 'email-otp';

  // ─── Shared state ────────────────────────────────────────────────────────
  loading = false;
  error = '';
  returnUrl = '/app/dashboard';

  // ─── Email + Password form ───────────────────────────────────────────────
  passwordForm!: FormGroup;
  showPassword = false;

  // ─── Email OTP flow ──────────────────────────────────────────────────────
  otpStep: OtpStep = 'email';
  otpEmailForm!: FormGroup;
  otpCodeForm!: FormGroup;
  otpEmail = '';               // captured from step 1
  otpSent = false;

  // Resend countdown (60 s)
  resendCountdown = 0;
  private resendCountdownSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/dashboard';

    this.passwordForm = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.otpEmailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.otpCodeForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  ngOnDestroy(): void {
    this.clearResendCountdown();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Method switcher ─────────────────────────────────────────────────────

  selectMethod(method: AuthMethod): void {
    if (this.loading) return;
    this.activeMethod = method;
    this.error = '';
  }

  // ─── Email + Password ────────────────────────────────────────────────────

  onPasswordSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const { email, password } = this.passwordForm.value;

    this.authService.login(email, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.router.navigate([this.returnUrl]);
          } else {
            this.error = res.error || 'Login failed';
            this.loading = false;
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Invalid email or password.';
          this.loading = false;
        }
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // ─── Email OTP — Step 1: send OTP ────────────────────────────────────────

  onSendOtp(): void {
    if (this.otpEmailForm.invalid) {
      this.otpEmailForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    this.otpEmail = this.otpEmailForm.value.email;

    this.authService.sendOtp(this.otpEmail)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.otpStep = 'code';
          this.otpSent = true;
          this.startResendCountdown();
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.error || '';
          if (err.status === 429 || msg.includes('wait')) {
            this.error = msg || 'Please wait before requesting another code.';
            // Jump straight to OTP input if a code was already sent
            this.otpStep = 'code';
            this.otpSent = true;
            this.startResendCountdown();
          } else {
            this.error = msg || 'Failed to send code. Please try again.';
          }
        }
      });
  }

  // ─── Email OTP — Step 2: verify OTP ──────────────────────────────────────

  onVerifyOtp(): void {
    if (this.otpCodeForm.invalid) {
      this.otpCodeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.verifyOtp(this.otpEmail, this.otpCodeForm.value.otp)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.router.navigate([this.returnUrl]);
          } else {
            this.error = res.error || 'Verification failed.';
            this.loading = false;
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Invalid or expired code.';
          this.loading = false;
        }
      });
  }

  resendOtp(): void {
    if (this.resendCountdown > 0 || this.loading) return;
    this.otpCodeForm.reset();
    this.error = '';
    this.onSendOtp();
  }

  backToOtpEmail(): void {
    this.otpStep = 'email';
    this.otpSent = false;
    this.error = '';
    this.otpCodeForm.reset();
    this.clearResendCountdown();
    this.resendCountdown = 0;
  }

  private clearResendCountdown(): void {
    this.resendCountdownSub?.unsubscribe();
    this.resendCountdownSub = undefined;
  }

  private startResendCountdown(): void {
    this.clearResendCountdown();
    this.resendCountdown = 60;
    this.resendCountdownSub = timer(0, 1000)
      .pipe(
        map((tick) => 60 - tick),
        take(61),
        takeUntil(this.destroy$)
      )
      .subscribe((n) => {
        this.resendCountdown = n;
      });
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  async loginWithGoogle(): Promise<void> {
    try {
      this.loading = true;
      this.error = '';

      const response = await this.http.get<{ success: boolean; authUrl: string }>(
        `${environment.apiUrl}/auth/google`
      ).toPromise();

      if (response?.success && response.authUrl) {
        window.location.href = response.authUrl;
      } else {
        this.error = 'Failed to initiate Google login.';
        this.loading = false;
      }
    } catch (err: any) {
      this.error = err?.error?.message || 'Failed to connect to Google.';
      this.loading = false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  hasError(form: FormGroup, field: string, error: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.hasError(error) && (ctrl.dirty || ctrl.touched));
  }

  fieldClass(form: FormGroup, field: string): string {
    const ctrl = form.get(field);
    const invalid = ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
    return invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-gray-200 focus:border-rep-lime focus:ring-rep-lime/20';
  }
}
