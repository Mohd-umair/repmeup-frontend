import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subject, takeUntil, Subscription } from 'rxjs';
import { PublicAuditService, GrowthAudit } from '../../core/services/public-audit.service';

interface ScanStep {
  label: string;
  sublabel: string;
  done: boolean;
  active: boolean;
}

@Component({
  selector: 'app-audit-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-progress.component.html',
  styleUrls: ['./audit-progress.component.scss']
})
export class AuditProgressComponent implements OnInit, OnDestroy {
  @Input() auditId!: string;
  @Output() completed = new EventEmitter<GrowthAudit>();
  @Output() failed = new EventEmitter<string>();

  steps: ScanStep[] = [
    { label: 'Instagram', sublabel: 'Scanning posts, comments & buying-intent signals', done: false, active: false },
    { label: 'Facebook', sublabel: 'Analysing page engagement & comment reply rate', done: false, active: false },
    { label: 'Google Reviews', sublabel: 'Checking rating, review count & owner replies', done: false, active: false },
    { label: 'Engagement Analysis', sublabel: 'Computing reply rates & posting consistency', done: false, active: false },
    { label: 'Buying Intent Detection', sublabel: 'Identifying unanswered sales opportunities', done: false, active: false },
    { label: 'Revenue Leak Calculation', sublabel: 'Estimating monthly revenue loss in ₹', done: false, active: false },
    { label: 'AI Recommendations', sublabel: 'RepMeUp AI writing your growth plan…', done: false, active: false },
  ];

  overallProgress = 0;
  private stepSub?: Subscription;
  private pollSub?: Subscription;
  private destroy$ = new Subject<void>();
  private currentStepIdx = 0;
  private MIN_ANIMATION_MS = 8000; // 8s minimum animation for perceived quality
  private startedAt = Date.now();
  private backendDone = false;
  private backendAudit: GrowthAudit | null = null;

  constructor(private auditService: PublicAuditService) {}

  ngOnInit(): void {
    this.startAnimation();
    this.startPolling();
  }

  private startAnimation(): void {
    // Reveal steps every ~1.1 seconds
    const stepInterval = Math.round(this.MIN_ANIMATION_MS / this.steps.length);
    this.stepSub = interval(stepInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.currentStepIdx < this.steps.length) {
          if (this.currentStepIdx > 0) {
            this.steps[this.currentStepIdx - 1].active = false;
            this.steps[this.currentStepIdx - 1].done = true;
          }
          this.steps[this.currentStepIdx].active = true;
          this.currentStepIdx++;
          this.overallProgress = Math.round((this.currentStepIdx / this.steps.length) * 90);
        } else {
          // All steps revealed — check if backend is done
          this.steps[this.steps.length - 1].done = true;
          this.steps[this.steps.length - 1].active = false;
          this.overallProgress = 95;
          this.stepSub?.unsubscribe();
          this.tryComplete();
        }
      });
  }

  private startPolling(): void {
    this.pollSub = this.auditService.pollUntilDone(this.auditId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (audit) => {
          if (audit.status === 'done' || audit.status === 'partial') {
            this.backendDone = true;
            this.backendAudit = audit;
            this.tryComplete();
          } else if (audit.status === 'failed') {
            this.failed.emit(audit.errorMessage || 'Audit failed. Please try again.');
          }
        },
        error: () => {
          this.failed.emit('Connection error. Please refresh the page.');
        }
      });
  }

  private tryComplete(): void {
    const elapsed = Date.now() - this.startedAt;
    const allStepsDone = this.currentStepIdx >= this.steps.length;
    if (this.backendDone && allStepsDone) {
      const remaining = this.MIN_ANIMATION_MS - elapsed;
      setTimeout(() => {
        this.overallProgress = 100;
        setTimeout(() => {
          if (this.backendAudit) this.completed.emit(this.backendAudit);
        }, 400);
      }, Math.max(0, remaining));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
