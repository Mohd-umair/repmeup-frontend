import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuditProgressComponent } from './audit-progress.component';
import { AuditReportComponent } from './audit-report.component';
import { PublicAuditService, GrowthAudit } from '../../core/services/public-audit.service';

type PageState = 'progress' | 'report' | 'error';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, AuditProgressComponent, AuditReportComponent],
  template: `
    @if (state === 'progress') {
      <app-audit-progress
        [auditId]="auditId"
        (completed)="onAuditComplete($event)"
        (failed)="onAuditFailed($event)"
      />
    } @else if (state === 'report' && audit) {
      <app-audit-report [audit]="audit" (auditUpdated)="onAuditUpdated($event)" />
    } @else if (state === 'error') {
      <div class="audit-page-error">
        <h2>Something went wrong</h2>
        <p>{{ errorMessage }}</p>
        <button (click)="goBack()">Try Again</button>
      </div>
    }
  `,
  styles: [`
    .audit-page-error {
      min-height: 60vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 6rem 24px 40px;
      gap: 16px;
    }
    @media (min-width: 640px) {
      .audit-page-error { padding-top: 7rem; }
    }
    .audit-page-error button {
      padding: 12px 28px;
      background: #000;
      color: #c6f135;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 15px;
      :root.dark & { background: #c6f135; color: #000; }
    }
  `]
})
export class AuditPageComponent implements OnInit, OnDestroy {
  auditId = '';
  state: PageState = 'progress';
  audit: GrowthAudit | null = null;
  errorMessage = '';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auditService: PublicAuditService
  ) {}

  ngOnInit(): void {
    this.auditId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.auditId) {
      this.router.navigate(['/growth-audit']);
      return;
    }

    // If already done (e.g. cached), skip progress animation
    this.auditService.getAudit(this.auditId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: resp => {
          if (resp.audit.status === 'done' || resp.audit.status === 'partial') {
            this.audit = resp.audit;
            this.state = 'report';
          }
          // else let progress component handle polling
        },
        error: () => {}
      });
  }

  onAuditComplete(audit: GrowthAudit): void {
    this.audit = audit;
    this.state = 'report';
  }

  onAuditFailed(message: string): void {
    this.errorMessage = message;
    this.state = 'error';
  }

  onAuditUpdated(audit: GrowthAudit): void {
    this.audit = audit;
  }

  goBack(): void {
    this.router.navigate(['/growth-audit']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
