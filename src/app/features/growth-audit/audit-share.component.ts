import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PublicAuditService, GrowthAudit } from '../../core/services/public-audit.service';
import { AuditReportComponent } from './audit-report.component';

@Component({
  selector: 'app-audit-share',
  standalone: true,
  imports: [CommonModule, AuditReportComponent],
  template: `
    @if (loading) {
      <div class="share-loading">
        <div class="share-spinner"></div>
        <p>Loading Growth Intelligence Report…</p>
      </div>
    } @else if (error) {
      <div class="share-error">
        <h2>Report not found</h2>
        <p>{{ error }}</p>
        <a href="/growth-audit">Run a free audit →</a>
      </div>
    } @else if (audit) {
      <app-audit-report [audit]="audit" (auditUpdated)="audit = $event" />
    }
  `,
  styles: [`
    .share-loading, .share-error {
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 16px;
      padding: 40px 24px;
    }
    .share-spinner {
      width: 40px; height: 40px;
      border: 3px solid #e0e0e0;
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      @keyframes spin { to { transform: rotate(360deg); } }
      :root.dark & { border-top-color: #c6f135; }
    }
    a { color: #000; font-weight: 600; :root.dark & { color: #c6f135; } }
  `]
})
export class AuditShareComponent implements OnInit, OnDestroy {
  audit: GrowthAudit | null = null;
  loading = true;
  error = '';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auditService: PublicAuditService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const token = this.route.snapshot.paramMap.get('token') || '';

    if (!id || !token) {
      this.error = 'Invalid report link.';
      this.loading = false;
      return;
    }

    this.auditService.getSharedAudit(id, token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: resp => {
          this.audit = resp.audit;
          this.loading = false;
        },
        error: err => {
          this.error = err?.error?.error || 'Report not found or the link has expired (30 days).';
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
