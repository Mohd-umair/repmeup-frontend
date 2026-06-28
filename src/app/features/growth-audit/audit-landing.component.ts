import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicAuditService, Industry, AuditCreateInput } from '../../core/services/public-audit.service';

function atLeastOnePlatform(group: AbstractControl): ValidationErrors | null {
  const ig = group.get('igHandle')?.value?.trim();
  const fb = group.get('fbPageUrl')?.value?.trim();
  const google = group.get('googleQuery')?.value?.trim();
  return (ig || fb || google) ? null : { platformRequired: true };
}

@Component({
  selector: 'app-audit-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-landing.component.html',
  styleUrls: ['./audit-landing.component.scss']
})
export class AuditLandingComponent implements OnInit, OnDestroy {
  form: FormGroup;
  industries: Industry[] = [];
  loading = false;
  error = '';
  private destroy$ = new Subject<void>();

  readonly stats = [
    { value: '₹74,000', label: 'Average monthly revenue lost to unanswered conversations' },
    { value: '89%', label: 'Of buying-intent comments go unanswered by most brands' },
    { value: '11 hrs', label: 'Average response time — customers leave after 5 minutes' }
  ];

  constructor(
    private fb: FormBuilder,
    private auditService: PublicAuditService,
    private router: Router
  ) {
    this.form = this.fb.group({
      igHandle:      [''],
      fbPageUrl:     [''],
      googleQuery:   [''],
      businessName:  [''],
      industry:      ['general', Validators.required],
      avgOrderValue: ['']
    }, { validators: atLeastOnePlatform });
  }

  ngOnInit(): void {
    this.auditService.getIndustries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: resp => { this.industries = resp.industries; },
        error: () => {}
      });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.loading) return;
    this.loading = true;
    this.error = '';

    const v = this.form.value;
    const payload: AuditCreateInput = {
      industry: v.industry,
      avgOrderValue: v.avgOrderValue ? parseFloat(v.avgOrderValue) : undefined
    };

    if (v.igHandle?.trim()) payload.igHandle = v.igHandle.trim();
    if (v.fbPageUrl?.trim()) payload.fbPageUrl = v.fbPageUrl.trim();
    if (v.googleQuery?.trim()) payload.googleQuery = v.googleQuery.trim();
    if (v.businessName?.trim()) payload.businessName = v.businessName.trim();
    if (!payload.businessName) {
      payload.businessName = payload.igHandle || 'Your Business';
    }

    this.auditService.createAudit(payload).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: resp => {
          this.router.navigate(['/growth-audit', resp.auditId]);
        },
        error: err => {
          this.loading = false;
          this.error = err?.error?.error || 'Something went wrong. Please try again.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
