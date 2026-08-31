import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  PaymentGatewayService,
  IProviderCard,
  IPaymentIntegration,
  ICredentialSchemaField
} from '../../../../core/services/payment-gateway.service';
import { NotificationService } from '../../../../core/services/notification.service';

interface ProviderMeta {
  label: string;
  logo: string;
  description: string;
  docs: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  razorpay: {
    label: 'Razorpay',
    logo: 'assets/payment/razorpay.svg',
    description: 'Accept payments via UPI, cards, netbanking, and wallets. Indian businesses.',
    docs: 'https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/'
  },
  cashfree: {
    label: 'Cashfree',
    logo: 'assets/payment/cashfree.svg',
    description: 'Fast settlement, multiple payment modes. Indian businesses.',
    docs: 'https://docs.cashfree.com/docs/getting-started'
  },
  payu: {
    label: 'PayU',
    logo: 'assets/payment/payu.svg',
    description: 'PayU payment gateway for Indian merchants.',
    docs: 'https://docs.payu.in/'
  },
  phonepe: {
    label: 'PhonePe',
    logo: 'assets/payment/phonepe.svg',
    description: 'PhonePe payment gateway for UPI and cards.',
    docs: 'https://developer.phonepe.com/'
  },
  stripe: {
    label: 'Stripe',
    logo: 'assets/payment/stripe.svg',
    description: 'Global card payments and many more methods.',
    docs: 'https://stripe.com/docs/keys'
  }
};

@Component({
  selector: 'app-payment-gateways',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './payment-gateways.component.html',
  styleUrls: ['./payment-gateways.component.scss']
})
export class PaymentGatewaysComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  providers: IProviderCard[] = [];
  integrations: IPaymentIntegration[] = [];

  loading = true;
  error: string | null = null;

  // Connect modal state
  connectModal: {
    open: boolean;
    provider: IProviderCard | null;
    schema: ICredentialSchemaField[];
    form: FormGroup | null;
    environment: 'test' | 'live';
    displayName: string;
    submitting: boolean;
    webhookUrl: string | null;
    webhookCopied: boolean;
  } = {
    open: false,
    provider: null,
    schema: [],
    form: null,
    environment: 'test',
    displayName: '',
    submitting: false,
    webhookUrl: null,
    webhookCopied: false
  };

  // Health check / disconnect loading
  actionLoading: Record<string, boolean> = {};

  readonly providerMeta = PROVIDER_META;

  constructor(
    private gatewayService: PaymentGatewayService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.gatewayService
      .listGateways()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.providers = res.providers;
          this.integrations = res.integrations;
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load payment gateways. Please try again.';
          this.loading = false;
        }
      });
  }

  getProviderMeta(provider: string): ProviderMeta {
    return (
      PROVIDER_META[provider] || {
        label: provider.charAt(0).toUpperCase() + provider.slice(1),
        logo: '',
        description: '',
        docs: ''
      }
    );
  }

  getIntegration(provider: string): IPaymentIntegration | undefined {
    return this.integrations.find((i) => i.provider === provider && i.status === 'connected');
  }

  // ── Connect modal ─────────────────────────────────────────────────────────

  openConnectModal(providerCard: IProviderCard): void {
    const schema = providerCard.credentialSchema;
    const controls: Record<string, FormControl> = {};
    for (const field of schema) {
      controls[field.key] = new FormControl('', Validators.required);
    }

    this.connectModal = {
      open: true,
      provider: providerCard,
      schema,
      form: new FormGroup(controls),
      environment: 'test',
      displayName: `${this.getProviderMeta(providerCard.provider).label} (Test)`,
      submitting: false,
      webhookUrl: null,
      webhookCopied: false
    };
  }

  closeConnectModal(): void {
    this.connectModal.open = false;
    this.connectModal.provider = null;
    this.connectModal.form = null;
    this.connectModal.webhookUrl = null;
  }

  onEnvironmentChange(): void {
    const meta = this.getProviderMeta(this.connectModal.provider!.provider);
    this.connectModal.displayName = `${meta.label} (${this.connectModal.environment === 'live' ? 'Live' : 'Test'})`;
  }

  submitConnect(): void {
    if (!this.connectModal.form || this.connectModal.form.invalid) {
      this.connectModal.form?.markAllAsTouched();
      return;
    }

    this.connectModal.submitting = true;
    const credentials = this.connectModal.form.value as Record<string, string>;

    this.gatewayService
      .connectGateway({
        provider: this.connectModal.provider!.provider,
        environment: this.connectModal.environment,
        credentials,
        displayName: this.connectModal.displayName
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.connectModal.submitting = false;
          this.connectModal.webhookUrl = res.webhookUrl;
          this.notification.success(
            'Gateway connected',
            `${this.getProviderMeta(res.integration.provider).label} is now connected in ${res.integration.environment} mode.`
          );
          this.integrations = [
            ...this.integrations.filter((i) => i._id !== res.integration._id),
            res.integration
          ];
          this.load();
        },
        error: (err) => {
          this.connectModal.submitting = false;
          const msg = err?.error?.error || 'Failed to connect gateway.';
          if (err?.error?.code === 'LIVE_ONBOARDING_GATED') {
            this.notification.error(
              'Live mode not available yet',
              'Razorpay Technology Partner approval is pending. Please use test mode.'
            );
          } else {
            this.notification.error('Connection failed', msg);
          }
        }
      });
  }

  copyWebhookUrl(): void {
    if (!this.connectModal.webhookUrl) return;
    navigator.clipboard.writeText(this.connectModal.webhookUrl).then(() => {
      this.connectModal.webhookCopied = true;
      setTimeout(() => (this.connectModal.webhookCopied = false), 2000);
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  setDefault(integration: IPaymentIntegration): void {
    this.actionLoading[integration._id + '-default'] = true;
    this.gatewayService
      .setDefault(integration._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notification.success('Default updated', 'This gateway will be used for new payment requests.');
          this.load();
          this.actionLoading[integration._id + '-default'] = false;
        },
        error: () => {
          this.notification.error('Update failed', 'Could not set default gateway.');
          this.actionLoading[integration._id + '-default'] = false;
        }
      });
  }

  healthCheck(integration: IPaymentIntegration): void {
    this.actionLoading[integration._id + '-health'] = true;
    this.gatewayService
      .healthCheck(integration._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.healthy) {
            this.notification.success('Health check passed', 'Credentials are valid.');
          } else {
            this.notification.error('Health check failed', res.error || 'Credentials may be invalid or expired.');
          }
          this.load();
          this.actionLoading[integration._id + '-health'] = false;
        },
        error: () => {
          this.notification.error('Health check error', 'Could not verify credentials.');
          this.actionLoading[integration._id + '-health'] = false;
        }
      });
  }

  disconnect(integration: IPaymentIntegration): void {
    if (!confirm(`Disconnect ${this.getProviderMeta(integration.provider).label}? Active payment links may stop working.`)) return;
    this.actionLoading[integration._id + '-disconnect'] = true;
    this.gatewayService
      .disconnect(integration._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notification.info('Gateway disconnected', 'The integration has been removed.');
          this.load();
          this.actionLoading[integration._id + '-disconnect'] = false;
        },
        error: () => {
          this.notification.error('Disconnect failed', 'Could not disconnect gateway.');
          this.actionLoading[integration._id + '-disconnect'] = false;
        }
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isLoading(key: string): boolean {
    return !!this.actionLoading[key];
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      connected: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      disconnected: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      error: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    return map[status] || map['pending'];
  }

  healthBadgeClass(status: 'ok' | 'error' | null | undefined): string {
    if (status === 'ok') return 'text-green-500 dark:text-green-400';
    if (status === 'error') return 'text-red-500 dark:text-red-400';
    return 'text-gray-400 dark:text-gray-500';
  }

  envBadgeClass(env: string): string {
    return env === 'live'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  hasField(key: string): boolean {
    return !!this.connectModal.form?.get(key);
  }

  fieldError(key: string): boolean {
    const ctrl = this.connectModal.form?.get(key);
    return !!(ctrl?.invalid && ctrl?.touched);
  }
}
