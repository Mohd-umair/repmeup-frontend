import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VoiceIvrService } from '../../../core/services/voice-ivr.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import {
  IVoiceAgent,
  IVoiceAgentTemplate,
  IVoiceAgentTool,
  VoiceToolAction,
  VoiceAgentIndustry
} from '../../../core/models/voice-ivr.model';

interface ToolCatalogEntry {
  action: VoiceToolAction;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-voice-agents',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-agents.component.html',
  styleUrls: ['./voice-agents.component.scss']
})
export class VoiceAgentsComponent implements OnInit, OnDestroy {
  loading = true;
  saving = false;
  agents: IVoiceAgent[] = [];
  templates: IVoiceAgentTemplate[] = [];

  // Builder modal state
  builderOpen = false;
  builderStep: 'template' | 'edit' = 'template';
  editing: IVoiceAgent | null = null;
  draft: IVoiceAgent = this.emptyDraft();
  newHandoffKeyword = '';

  readonly languageOptions = [
    { value: 'en-IN', label: 'English (India)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'hi-IN', label: 'Hindi' },
    { value: 'ta-IN', label: 'Tamil' },
    { value: 'te-IN', label: 'Telugu' },
    { value: 'mr-IN', label: 'Marathi' },
    { value: 'gu-IN', label: 'Gujarati' },
    { value: 'bn-IN', label: 'Bengali' },
    { value: 'kn-IN', label: 'Kannada' },
    { value: 'ml-IN', label: 'Malayalam' },
    { value: 'pa-IN', label: 'Punjabi' },
    { value: 'or-IN', label: 'Odia' }
  ];

  readonly voiceOptions = [
    { value: 'meera', label: 'Meera (Female · Warm)' },
    { value: 'pavithra', label: 'Pavithra (Female · Professional)' },
    { value: 'maitreyi', label: 'Maitreyi (Female · Friendly)' },
    { value: 'arvind', label: 'Arvind (Male · Authoritative)' },
    { value: 'amol', label: 'Amol (Male · Casual)' },
    { value: 'amartya', label: 'Amartya (Male · Calm)' }
  ];

  readonly toolCatalog: ToolCatalogEntry[] = [
    { action: 'create_contact',           label: 'Save caller as contact', description: 'Upsert a CRM contact with the caller details.', icon: 'fa-user-plus' },
    { action: 'log_call_interaction',     label: 'Log call to inbox',       description: 'Drop a thread into the unified inbox for follow-up.', icon: 'fa-inbox' },
    { action: 'send_whatsapp_followup',   label: 'Send WhatsApp follow-up', description: 'Queue a WhatsApp message after the call.', icon: 'fa-comment' },
    { action: 'lookup_appointment',       label: 'Lookup appointment',      description: 'Find an existing booking for the caller.', icon: 'fa-calendar-check' },
    { action: 'book_appointment',         label: 'Book appointment',        description: 'Create a new booking from caller intent.', icon: 'fa-calendar-plus' },
    { action: 'check_product_availability', label: 'Check product stock',   description: 'Look up product/inventory by name.', icon: 'fa-boxes-stacked' },
    { action: 'transfer_to_human',        label: 'Transfer to human',       description: 'Hand off the call when the caller asks for an agent.', icon: 'fa-user-headset' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private voiceSvc: VoiceIvrService,
    private notify: NotificationService,
    private swal: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.loadAgents();
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private loadAgents(): void {
    this.loading = true;
    this.voiceSvc.listAgents().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.agents = res.data || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  private loadTemplates(): void {
    this.voiceSvc.getAgentTemplates().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.templates = res.data || []; }
    });
  }

  // ── Builder modal flow ────────────────────────────────────────────────────

  openCreate(): void {
    this.editing = null;
    this.draft = this.emptyDraft();
    this.builderStep = 'template';
    this.builderOpen = true;
  }

  openEdit(agent: IVoiceAgent): void {
    this.editing = agent;
    this.draft = this.cloneAgentForEdit(agent);
    this.builderStep = 'edit';
    this.builderOpen = true;
  }

  closeBuilder(): void {
    this.builderOpen = false;
  }

  pickTemplate(tpl: IVoiceAgentTemplate): void {
    this.draft = {
      ...this.emptyDraft(),
      name: tpl.name,
      industry: tpl.industry,
      systemPrompt: tpl.systemPrompt,
      greetingMessage: tpl.greetingMessage,
      workflow: { ...this.emptyDraft().workflow, ...tpl.workflow },
      tools: tpl.tools.map((action) => this.toolForAction(action))
    };
    this.builderStep = 'edit';
  }

  toggleTool(action: VoiceToolAction): void {
    const idx = this.draft.tools.findIndex((t) => t.action === action);
    if (idx >= 0) this.draft.tools.splice(idx, 1);
    else this.draft.tools.push(this.toolForAction(action));
  }

  hasTool(action: VoiceToolAction): boolean {
    return this.draft.tools.some((t) => t.action === action);
  }

  addHandoffKeyword(): void {
    const kw = (this.newHandoffKeyword || '').trim();
    if (!kw) return;
    const arr = this.draft.workflow.humanHandoffKeywords || [];
    if (!arr.includes(kw)) arr.push(kw);
    this.draft.workflow.humanHandoffKeywords = arr;
    this.newHandoffKeyword = '';
  }

  removeHandoffKeyword(kw: string): void {
    const arr = this.draft.workflow.humanHandoffKeywords || [];
    this.draft.workflow.humanHandoffKeywords = arr.filter((k) => k !== kw);
  }

  save(): void {
    if (!this.draft.name?.trim()) {
      this.notify.warning('Name required', 'Give your voice agent a friendly name.');
      return;
    }
    if (!this.draft.systemPrompt?.trim()) {
      this.notify.warning('System prompt required', 'Add at least a short system prompt.');
      return;
    }
    this.saving = true;
    const obs = this.editing && this.editing._id
      ? this.voiceSvc.updateAgent(this.editing._id, this.draft)
      : this.voiceSvc.createAgent(this.draft);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.saving = false;
        this.builderOpen = false;
        this.notify.success(this.editing ? 'Agent updated' : 'Agent created', this.draft.name);
        this.loadAgents();
      },
      error: (err) => {
        this.saving = false;
        this.notify.error('Save failed', err?.error?.error || 'Could not save the agent.');
      }
    });
  }

  delete(agent: IVoiceAgent): void {
    this.swal.confirmDelete(
      'Delete this voice agent?',
      `"${agent.name}" will be removed and unassigned from all phone numbers.`
    ).then((result) => {
      if (!result.isConfirmed || !agent._id) return;
      this.voiceSvc.deleteAgent(agent._id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.notify.success('Agent deleted', agent.name);
          this.loadAgents();
        },
        error: (err) => this.notify.error('Delete failed', err?.error?.error || 'Could not delete agent.')
      });
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  industryLabel(industry: VoiceAgentIndustry | string): string {
    const t = this.templates.find((tpl) => tpl.industry === industry);
    return t?.name || (industry as string).replace(/_/g, ' ');
  }

  industryIcon(industry: VoiceAgentIndustry | string): string {
    const t = this.templates.find((tpl) => tpl.industry === industry);
    return t?.icon || 'fa-robot';
  }

  prettyToolName(action: string): string {
    return (action || '').replace(/_/g, ' ');
  }

  private emptyDraft(): IVoiceAgent {
    return {
      name: '',
      industry: 'custom',
      systemPrompt: '',
      greetingMessage: 'Hello! How can I help you today?',
      language: 'en-IN',
      voiceId: 'meera',
      tools: [],
      workflow: {
        sendWhatsappFollowUp: false,
        createContact: true,
        createInboxInteraction: true,
        humanHandoffKeywords: ['talk to agent', 'human', 'representative'],
        maxCallDurationSeconds: 600
      },
      isActive: true
    };
  }

  private cloneAgentForEdit(agent: IVoiceAgent): IVoiceAgent {
    return {
      ...this.emptyDraft(),
      ...agent,
      tools: (agent.tools || []).map((t) => ({ ...t })),
      workflow: {
        ...this.emptyDraft().workflow,
        ...(agent.workflow || {}),
        humanHandoffKeywords: [...(agent.workflow?.humanHandoffKeywords || [])]
      }
    };
  }

  private toolForAction(action: VoiceToolAction): IVoiceAgentTool {
    const entry = this.toolCatalog.find((c) => c.action === action);
    return {
      action,
      name: action,
      description: entry?.description || '',
      enabled: true
    };
  }
}
