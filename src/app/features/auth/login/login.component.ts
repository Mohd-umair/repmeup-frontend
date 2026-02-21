import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * Login Component - Single Responsibility Principle
 * Handles user login functionality
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  error = '';
  returnUrl = '/app/dashboard';
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Get return url from route parameters or default to '/app/dashboard'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/app/dashboard';

    // Initialize form
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response) => {
        if (response.success) {
          this.router.navigate([this.returnUrl]);
        } else {
          this.error = response.error || 'Login failed';
          this.loading = false;
        }
      },
      error: (error) => {
        this.error = error.error?.error || 'An error occurred during login';
        this.loading = false;
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Check if form field has error
   */
  hasError(field: string, error: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.hasError(error) && (control.dirty || control.touched));
  }

  /**
   * Login with Google OAuth
   */
  async loginWithGoogle(): Promise<void> {
    try {
      this.loading = true;
      this.error = '';

      const response = await this.http.get<{ success: boolean; authUrl: string }>(
        `${environment.apiUrl}/auth/google`
      ).toPromise();

      if (response && response.success && response.authUrl) {
        // Redirect to Google OAuth
        window.location.href = response.authUrl;
      } else {
        this.error = 'Failed to initiate Google login';
        this.loading = false;
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      this.error = error?.error?.message || 'Failed to connect to Google';
      this.loading = false;
    }
  }
}
