import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  PublicAuditService,
  GrowthAudit,
  AuditOpportunity
} from '../../core/services/public-audit.service';

@Component({
  selector: 'app-audit-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './audit-report.component.html',
  styleUrls: ['./audit-report.component.scss']
})
export class AuditReportComponent implements OnInit, OnDestroy {
  @Input() audit!: GrowthAudit;
  @Output() auditUpdated = new EventEmitter<GrowthAudit>();

  leadForm: FormGroup;
  leadLoading = false;
  leadError = '';
  showLeadGate = false;
  private destroy$ = new Subject<void>();

  readonly RING_RADIUS = 42;
  readonly RING_CIRCUMFERENCE = 2 * Math.PI * this.RING_RADIUS;

  readonly gradeColors: Record<string, string> = {
    A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444'
  };

  readonly gradeLabels: Record<string, string> = {
    A: 'Excellent', B: 'Good', C: 'Needs Work', D: 'Critical', F: 'Emergency'
  };

  constructor(
    private fb: FormBuilder,
    private auditService: PublicAuditService,
    private router: Router
  ) {
    this.leadForm = this.fb.group({
      name:     ['', Validators.required],
      email:    ['', [Validators.required, Validators.email]],
      phone:    [''],
      business: ['']
    });
  }

  ngOnInit(): void {
    this.showLeadGate = !this.audit.leadCaptured && !!this.audit.score;
  }

  get scoreOffset(): number {
    const score = this.audit?.score ?? 0;
    return this.RING_CIRCUMFERENCE - (score / 100) * this.RING_CIRCUMFERENCE;
  }

  get answeredCount(): number {
    const total = this.audit.modules?.socialPresence?.igBuyingIntentCount || 0;
    return Math.max(0, total - this.unansweredBuying);
  }

  get reportDate(): string {
    const d = this.audit.createdAt ? new Date(this.audit.createdAt) : new Date();
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  get gradeColor(): string {
    return this.gradeColors[this.audit.grade || 'F'] || '#ef4444';
  }

  get gradeLabel(): string {
    return this.gradeLabels[this.audit.grade || 'F'] || 'Emergency';
  }

  get revenueLeak(): number {
    return this.audit.modules?.revenueLeak?.number ?? this.audit.revenueLeak ?? 0;
  }

  get unansweredBuying(): number {
    return this.audit.modules?.revenueLeak?.unansweredBuying ?? this.audit.unansweredBuying ?? 0;
  }

  get hasInstagram(): boolean {
    return !!this.audit.igHandle;
  }

  get hasFacebook(): boolean {
    return !!this.audit.fbPageUrl;
  }

  get hasGoogle(): boolean {
    return !!this.audit.googleQuery;
  }

  get hasSocialAudit(): boolean {
    return this.hasInstagram || this.hasFacebook;
  }

  get hasReputationAudit(): boolean {
    return this.hasGoogle || this.hasFacebook;
  }

  formatCurrency(amount: number): string {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  benchmarkDelta(actual: number, benchmark: number): string {
    const diff = actual - benchmark;
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(0)}%`;
  }

  benchmarkClass(actual: number, benchmark: number): string {
    return actual >= benchmark ? 'positive' : 'negative';
  }

  progressWidth(value: number, max: number = 100): string {
    return `${Math.min(100, Math.round((value / max) * 100))}%`;
  }

  opportunityProgressWidth(opp: AuditOpportunity): string {
    return `${Math.min(100, Math.round((opp.currentValue / opp.improvedValue) * 100))}%`;
  }

  submitLead(): void {
    if (this.leadForm.invalid || this.leadLoading) return;
    this.leadLoading = true;
    this.leadError = '';

    this.auditService.captureLead(this.audit.id, this.leadForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: resp => {
          this.audit = resp.audit;
          this.showLeadGate = false;
          this.auditUpdated.emit(resp.audit);
        },
        error: err => {
          this.leadLoading = false;
          this.leadError = err?.error?.error || 'Something went wrong. Please try again.';
        }
      });
  }

  downloadPdf(): void {
    const url = this.auditService.getPdfUrl(this.audit.id, this.audit.shareToken);
    window.open(url, '_blank');
  }

  copyShareLink(): void {
    if (!this.audit.shareToken) return;
    const url = `${window.location.origin}/growth-audit/r/${this.audit.id}/${this.audit.shareToken}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Share link copied!');
    });
  }

  bookDemo(): void {
    this.router.navigate(['/book-demo']);
  }

  startTrial(): void {
    this.router.navigate(['/auth/register']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
