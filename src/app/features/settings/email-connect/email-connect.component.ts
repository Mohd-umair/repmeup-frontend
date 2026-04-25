import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  EmailAccountService,
  EmailConnection
} from '../../../core/services/email-account.service';
import { NotificationService } from '../../../core/services/notification.service';

type ProviderTab = 'gmail' | 'outlook' | 'imap';

@Component({
  selector: 'app-email-connect',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './email-connect.component.html'
})
export class EmailConnectComponent implements OnInit, OnDestroy {
  @Output() connectionsChanged = new EventEmitter<void>();

  activeTab: ProviderTab = 'gmail';
  connections: EmailConnection[] = [];
  loading = false;
  connecting = false;
  disconnecting: Record<string, boolean> = {};

  imapForm!: FormGroup;
  showImapPassword = false;

  private destroy$ = new Subject<void>();

  constructor(
    private emailAccountService: EmailAccountService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this._buildImapForm();
    this._loadConnections();
    this._handleOAuthCallback();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Tab ─────────────────────────────────────────────────────────────────────

  setTab(tab: ProviderTab): void {
    this.activeTab = tab;
  }

  // ── Connections ─────────────────────────────────────────────────────────────

  private _loadConnections(): void {
    this.loading = true;
    this.emailAccountService.listConnections()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.connections = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  connectionsByProvider(provider: ProviderTab): EmailConnection[] {
    return this.connections.filter(c => c.platformData?.emailProvider === provider);
  }

  // ── Gmail ───────────────────────────────────────────────────────────────────

  connectGmail(): void {
    this.connecting = true;
    this.emailAccountService.connectGmail();
    // Browser redirects — connecting flag stays true until page reloads
  }

  // ── Outlook ─────────────────────────────────────────────────────────────────

  connectOutlook(): void {
    this.connecting = true;
    this.emailAccountService.connectOutlook();
  }

  // ── IMAP ────────────────────────────────────────────────────────────────────

  private _buildImapForm(): void {
    this.imapForm = this.fb.group({
      emailAddress: ['', [Validators.required, Validators.email]],
      imapHost: ['', Validators.required],
      imapPort: [993, [Validators.required, Validators.min(1), Validators.max(65535)]],
      imapSecure: [true],
      smtpHost: ['', Validators.required],
      smtpPort: [465, [Validators.required, Validators.min(1), Validators.max(65535)]],
      smtpSecure: [true],
      password: ['', Validators.required]
    });
  }

  connectImap(): void {
    if (this.imapForm.invalid) {
      this.imapForm.markAllAsTouched();
      return;
    }

    this.connecting = true;
    this.emailAccountService.connectImap(this.imapForm.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.connecting = false;
          this.notificationService.success('Email Connected', res.message);
          this.imapForm.reset({ imapPort: 993, imapSecure: true, smtpPort: 465, smtpSecure: true });
          this._loadConnections();
          this.connectionsChanged.emit();
        },
        error: err => {
          this.connecting = false;
          this.notificationService.error(
            'Connection Failed',
            err?.error?.error || 'Could not connect to your email server. Please check your settings.'
          );
        }
      });
  }

  toggleImapPassword(): void {
    this.showImapPassword = !this.showImapPassword;
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  disconnect(connectionId: string): void {
    this.disconnecting[connectionId] = true;
    this.emailAccountService.disconnect(connectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          delete this.disconnecting[connectionId];
          this.notificationService.success('Disconnected', 'Email account disconnected');
          this._loadConnections();
          this.connectionsChanged.emit();
        },
        error: err => {
          delete this.disconnecting[connectionId];
          this.notificationService.error('Error', err?.error?.error || 'Failed to disconnect');
        }
      });
  }

  // ── OAuth Callback Handling ───────────────────────────────────────────────────

  private _handleOAuthCallback(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const connect = params['email_connect'];
        const provider = params['provider'];

        if (connect === 'success') {
          const label = provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'Email';
          this.notificationService.success(`${label} Connected`, `Your ${label} inbox is now connected!`);
          this._loadConnections();
          this.connectionsChanged.emit();
          this.router.navigate([], {
            queryParams: { tab: 'platforms' },
            replaceUrl: true
          });
        } else if (connect === 'denied') {
          this.notificationService.error('Connection Cancelled', 'You cancelled the email connection');
          this.router.navigate([], { queryParams: { tab: 'platforms' }, replaceUrl: true });
        } else if (connect === 'error') {
          this.notificationService.error('Connection Failed', 'Could not connect your email account. Please try again.');
          this.router.navigate([], { queryParams: { tab: 'platforms' }, replaceUrl: true });
        }
      });
  }

  // ── Helper ───────────────────────────────────────────────────────────────────

  providerLabel(provider: string): string {
    return { gmail: 'Gmail', outlook: 'Outlook', imap: 'Custom / IMAP' }[provider] || provider;
  }

  statusClass(status: string): string {
    return {
      connected: 'status-connected',
      disconnected: 'status-disconnected',
      error: 'status-error',
      token_expired: 'status-expired'
    }[status] || 'status-disconnected';
  }

  statusLabel(status: string): string {
    return {
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'Error',
      token_expired: 'Token Expired'
    }[status] || status;
  }

  isWatchExpiringSoon(connection: EmailConnection): boolean {
    const expiry = connection.platformData?.watchExpiry || connection.platformData?.msSubscriptionExpiry;
    if (!expiry) return false;
    return new Date(expiry) < new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  fieldError(field: string): string | null {
    const ctrl = this.imapForm.get(field);
    if (!ctrl || !ctrl.touched || ctrl.valid) return null;
    if (ctrl.errors?.['required']) return `${field} is required`;
    if (ctrl.errors?.['email']) return 'Enter a valid email address';
    if (ctrl.errors?.['min'] || ctrl.errors?.['max']) return 'Enter a valid port number (1–65535)';
    return 'Invalid value';
  }
}
