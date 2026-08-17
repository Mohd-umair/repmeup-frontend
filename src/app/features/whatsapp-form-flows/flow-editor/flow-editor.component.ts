import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { WhatsAppFormFlowService } from '../../../core/services/whatsapp-form-flow.service';
import { NotificationService } from '../../../core/services/notification.service';
import { IFlowTemplate, IWhatsAppFormFlow } from '../../../core/models/whatsapp-form-flow.model';
import { WhatsAppFlowPreviewComponent } from '../shared/whatsapp-flow-preview.component';

/** Copy a fresh form starts with — overwritten by the saved values when editing. */
const DEFAULT_COPY = {
  headerText: 'How was your experience?',
  ratingPrompt: 'Please rate your experience',
  commentPrompt: 'Anything you would like us to know?',
  thankYouText: 'Thank you for your feedback!'
};

@Component({
  selector: 'app-flow-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, WhatsAppFlowPreviewComponent],
  templateUrl: './flow-editor.component.html',
  styleUrls: ['./flow-editor.component.scss']
})
export class FlowEditorComponent implements OnInit, OnDestroy {
  private readonly flowService = inject(WhatsAppFormFlowService);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  isNew = true;
  loadingTemplates = true;
  saving = false;
  error: string | null = null;

  templates: IFlowTemplate[] = [];
  selectedTemplate: IFlowTemplate | null = null;
  flow: IWhatsAppFormFlow | null = null;

  readonly customizationForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    // Required by the star_rating_comment template — it is written into the
    // companion message template body at publish time.
    businessName: ['', Validators.required],
    headerText: [DEFAULT_COPY.headerText],
    ratingPrompt: [DEFAULT_COPY.ratingPrompt],
    commentPrompt: [DEFAULT_COPY.commentPrompt],
    thankYouText: [DEFAULT_COPY.thankYouText]
  });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    const flowId = this.route.snapshot.paramMap.get('id');
    this.isNew = !flowId;

    // Templates and the flow load together so `selectedTemplate` can be resolved
    // from the flow's templateKey without racing the template list.
    forkJoin({
      templates: this.flowService.getTemplates().pipe(catchError(() => of(null))),
      flow: flowId
        ? this.flowService.getFlow(flowId).pipe(catchError(() => of(null)))
        : of(null)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ templates, flow }) => {
        this.loadingTemplates = false;
        this.templates = templates?.data ?? [];

        if (!flowId) return;

        if (!flow?.data) {
          this.error = 'That form could not be loaded.';
          return;
        }

        this.flow = flow.data;
        this.selectedTemplate =
          this.templates.find((t) => t.key === flow.data.templateKey) ?? null;
        this.customizationForm.patchValue({
          name: flow.data.name,
          ...flow.data.customization
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTemplate(template: IFlowTemplate): void {
    this.selectedTemplate = template;
  }

  createFlow(): void {
    if (!this.selectedTemplate || this.customizationForm.invalid) {
      this.customizationForm.markAllAsTouched();
      this.notificationService.error(
        'Missing details',
        'Add a form name and your business name before creating it.'
      );
      return;
    }

    const { name, ...customization } = this.customizationForm.value;
    this.saving = true;

    this.flowService
      .createFlow({ templateKey: this.selectedTemplate.key, name, customization })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.notificationService.success('Form created', 'Publish it when the wording reads right.');
          this.goBack();
        },
        error: (err) => {
          this.saving = false;
          this.notificationService.error(
            'Could not create form',
            err?.error?.error || 'Something went wrong. Try again.'
          );
        }
      });
  }

  saveChanges(): void {
    if (!this.flow?._id || this.customizationForm.invalid) {
      this.customizationForm.markAllAsTouched();
      return;
    }

    const { name, ...customization } = this.customizationForm.value;
    this.saving = true;

    this.flowService
      .updateFlow(this.flow._id, { name, customization })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.saving = false;
          this.notificationService.success('Saved', 'Your changes have been saved.');
          this.goBack();
        },
        error: (err) => {
          this.saving = false;
          this.notificationService.error(
            'Could not save',
            err?.error?.error || 'Something went wrong. Try again.'
          );
        }
      });
  }

  goBack(): void {
    void this.router.navigate(['/app/whatsapp-form-flows']);
  }
}
