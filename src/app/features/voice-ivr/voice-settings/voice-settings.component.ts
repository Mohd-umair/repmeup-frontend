import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { VoiceIvrService } from '../../../core/services/voice-ivr.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SweetAlertService } from '../../../core/services/sweet-alert.service';
import {
  IVoiceCredentialSummary,
  IVoiceCredentialPayload,
  IPhoneNumber,
  IAvailableTwilioNumber,
  IVoiceAgent
} from '../../../core/models/voice-ivr.model';

@Component({
  selector: 'app-voice-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voice-settings.component.html',
  styleUrls: ['./voice-settings.component.scss']
})
export class VoiceSettingsComponent implements OnInit, OnDestroy {
  credentials: IVoiceCredentialSummary | null = null;
  credsLoading = true;
  credsSaving = false;

  /** UI mode — default to platform telephony for new workspaces */
  telephonyMode: 'managed' | 'byow' = 'managed';

  twilioAccountSid = '';
  twilioAuthToken = '';
  publicBaseUrl = '';

  numbers: IPhoneNumber[] = [];
  numbersLoading = true;

  searchOpen = false;
  searchCountry = 'US';
  searchAreaCode = '';
  searchContains = '';
  searchLimit = 20;
  searchResults: IAvailableTwilioNumber[] = [];
  searching = false;
  purchasing: string | null = null;

  registerLinkOpen = false;
  registerTwilioSid = '';
  registerAgentId = '';
  registerSubmitting = false;

  agents: IVoiceAgent[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private voiceSvc: VoiceIvrService,
    private notify: NotificationService,
    private swal: SweetAlertService
  ) {}

  ngOnInit(): void {
    this.loadCredentials();
    this.loadNumbers();
    this.loadAgents();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCredentials(): void {
    this.credsLoading = true;
    this.voiceSvc.getCredentials().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.credentials = res.data;
        if (this.credentials) {
          this.telephonyMode = this.credentials.telephonyMode === 'byow' ? 'byow' : 'managed';
          this.twilioAccountSid = this.credentials.twilioAccountSid || '';
          this.twilioAuthToken = this.credentials.twilioAuthToken || '';
          this.publicBaseUrl = this.credentials.publicBaseUrl || '';
        } else {
          this.telephonyMode = 'managed';
          this.twilioAccountSid = '';
          this.twilioAuthToken = '';
          this.publicBaseUrl = '';
        }
        this.credsLoading = false;
      },
      error: () => { this.credsLoading = false; }
    });
  }

  saveCredentials(): void {
    if (this.telephonyMode === 'byow') {
      if (!this.twilioAccountSid?.trim()) {
        this.notify.warning('Account ID required', 'Enter the telephony account identifier from your provider.');
        return;
      }
    }

    this.credsSaving = true;
    const payload: IVoiceCredentialPayload =
      this.telephonyMode === 'managed'
        ? {
            telephonyMode: 'managed',
            isActive: true,
            publicBaseUrl: this.publicBaseUrl?.trim() || ''
          }
        : {
            telephonyMode: 'byow',
            isActive: true,
            twilioAccountSid: this.twilioAccountSid,
            twilioAuthToken: this.twilioAuthToken,
            publicBaseUrl: this.publicBaseUrl?.trim() || ''
          };

    this.voiceSvc.updateCredentials(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.credsSaving = false;
        this.credentials = res.data;
        this.notify.success('Saved', 'Voice connection is updated for this workspace.');
        this.loadCredentials();
      },
      error: (err) => {
        this.credsSaving = false;
        this.notify.error('Save failed', err?.error?.error || 'Could not save settings.');
      }
    });
  }

  removeCredentials(): void {
    this.swal.confirmDelete(
      'Remove voice connection?',
      'Phone numbers will stop working until you connect again.'
    ).then((r) => {
      if (!r.isConfirmed) return;
      this.voiceSvc.deleteCredentials().pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.credentials = null;
          this.twilioAccountSid = '';
          this.twilioAuthToken = '';
          this.publicBaseUrl = '';
          this.telephonyMode = 'managed';
          this.notify.success('Removed', '');
        },
        error: (err) => this.notify.error('Remove failed', err?.error?.error || 'Could not remove settings.')
      });
    });
  }

  private loadNumbers(): void {
    this.numbersLoading = true;
    this.voiceSvc.listPhoneNumbers().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.numbers = res.data || []; this.numbersLoading = false; },
      error: () => { this.numbersLoading = false; }
    });
  }

  private loadAgents(): void {
    this.voiceSvc.listAgents().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { this.agents = res.data || []; }
    });
  }

  assignedAgentId(num: IPhoneNumber): string {
    return typeof num.assignedAgent === 'object' && num.assignedAgent
      ? (num.assignedAgent as any)._id
      : (num.assignedAgent as string) || '';
  }

  onAssignAgent(num: IPhoneNumber, agentId: string): void {
    this.voiceSvc.updatePhoneNumber(num._id, { assignedAgent: agentId } as any)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notify.success('Number updated', assignLabel(this.agents, agentId));
        this.loadNumbers();
      },
      error: (err) => this.notify.error('Update failed', err?.error?.error || 'Could not update number.')
    });
  }

  toggleActive(num: IPhoneNumber): void {
    this.voiceSvc.updatePhoneNumber(num._id, { isActive: !num.isActive } as any)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notify.success(num.isActive ? 'Number paused' : 'Number reactivated', num.number);
        this.loadNumbers();
      }
    });
  }

  release(num: IPhoneNumber): void {
    this.swal.confirmDelete(
      'Release this number?',
      `${num.number} will be released from your workspace and stop receiving calls.`
    ).then((r) => {
      if (!r.isConfirmed) return;
      this.voiceSvc.releasePhoneNumber(num._id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.notify.success('Number released', num.number);
          this.loadNumbers();
        },
        error: (err) => this.notify.error('Release failed', err?.error?.error || 'Could not release number.')
      });
    });
  }

  openSearch(): void {
    this.searchOpen = true;
    this.searchResults = [];
  }

  closeSearch(): void { this.searchOpen = false; }

  search(): void {
    this.searching = true;
    this.voiceSvc.searchAvailableNumbers({
      country: this.searchCountry,
      areaCode: this.searchAreaCode || undefined,
      contains: this.searchContains || undefined,
      limit: this.searchLimit
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.searchResults = res.data || [];
        this.searching = false;
        if (!this.searchResults.length) {
          this.notify.warning('No numbers found', 'Try another country or area code.');
        }
      },
      error: (err) => {
        this.searching = false;
        this.notify.error('Search failed', err?.error?.error || 'Could not search inventory. Check voice connection settings.');
      }
    });
  }

  buy(num: IAvailableTwilioNumber): void {
    this.purchasing = num.phoneNumber;
    this.voiceSvc.purchaseNumber({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.purchasing = null;
        this.notify.success('Number added', num.phoneNumber);
        this.searchOpen = false;
        this.loadNumbers();
      },
      error: (err) => {
        this.purchasing = null;
        this.notify.error('Purchase failed', err?.error?.error || 'Could not purchase number.');
      }
    });
  }

  toggleRegisterLink(): void {
    this.registerLinkOpen = !this.registerLinkOpen;
  }

  registerExistingTwilioNumber(): void {
    const sid = this.registerTwilioSid?.trim() || '';
    if (!sid.startsWith('PN')) {
      this.notify.warning('Invalid SID', 'Use the Incoming Phone Number SID from Twilio (starts with PN).');
      return;
    }
    if (!this.registerAgentId) {
      this.notify.warning('Agent required', 'Choose a voice agent to answer this number.');
      return;
    }
    this.registerSubmitting = true;
    this.voiceSvc.registerExistingNumber({
      twilioSid: sid,
      assignedAgent: this.registerAgentId
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.registerSubmitting = false;
        this.registerTwilioSid = '';
        this.registerAgentId = '';
        this.registerLinkOpen = false;
        this.notify.success('Number linked', 'Webhooks were refreshed when possible.');
        this.loadNumbers();
      },
      error: (err) => {
        this.registerSubmitting = false;
        this.notify.error('Link failed', err?.error?.error || 'Could not register this number.');
      }
    });
  }

  numberTypeLabel(t?: string): string {
    if (!t) return '—';
    const labels: Record<string, string> = {
      local: 'Local',
      national: 'National',
      mobile: 'Mobile',
      tollFree: 'Toll-free'
    };
    return labels[t] || t;
  }

  hasVoiceConnection(): boolean {
    if (!this.credentials?.isActive) return false;
    if (this.credentials.telephonyMode === 'managed') {
      return !!this.credentials.managedTelephonyReady;
    }
    return !!this.credentials.twilioAccountSid;
  }
}

function assignLabel(agents: IVoiceAgent[], agentId: string): string {
  const name = agents.find((a) => a._id === agentId)?.name;
  return `Routed to "${name || 'agent'}".`;
}
