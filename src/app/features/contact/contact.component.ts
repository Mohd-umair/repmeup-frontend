import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, timer } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import { SOCIAL_LINKS } from '../../core/constants/social-links.constants';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit, OnDestroy {
  readonly socialLinks = SOCIAL_LINKS;

  contactForm: FormGroup;
  submitted = false;
  loading = false;
  success = false;
  /** Server or network error — shown in template */
  submitError: string | null = null;

  /**
   * Optional intent from query (e.g. book-demo) — stored on ContactInquiry for super-admin.
   */
  private intentFromQuery: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.minLength(10)]],
      company: ['']
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(take(1), takeUntil(this.destroy$)).subscribe((qp) => {
      const intent = qp.get('intent');
      if (intent === 'book-demo') {
        this.router.navigate(['/book-demo'], { replaceUrl: true });
        return;
      }
    });
  }

  onSubmit(): void {
    this.submitted = true;
    this.submitError = null;

    if (!this.contactForm.valid) {
      return;
    }

    this.loading = true;
    this.success = false;

    const raw = this.contactForm.value;
    const body = {
      name: raw.name,
      email: raw.email,
      phone: raw.phone || '',
      company: raw.company || '',
      subject: raw.subject,
      message: raw.message,
      ...(this.intentFromQuery ? { intent: this.intentFromQuery } : {})
    };

    this.apiService
      .post<{ success: boolean; message: string; error?: string }>('/contact/submit', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success) {
            this.success = true;
            this.contactForm.reset();
            this.submitted = false;
            this.intentFromQuery = null;
            timer(5000)
              .pipe(take(1), takeUntil(this.destroy$))
              .subscribe(() => {
                this.success = false;
              });
          } else {
            this.submitError = res.error || 'Something went wrong. Please try again.';
          }
        },
        error: (err) => {
          this.loading = false;
          const msg =
            err?.error?.error ||
            err?.error?.message ||
            (typeof err?.error === 'string' ? err.error : null) ||
            'Could not send your message. Please try again later.';
          this.submitError = msg;
        }
      });
  }

  get f() {
    return this.contactForm.controls;
  }

  getFieldError(fieldName: string): string {
    const field = this.f[fieldName];
    if (field?.errors && this.submitted) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
      if (field.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (field.errors['minlength']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
