import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  PaymentGatewayService,
  IPaymentIntegration,
  IPayment
} from '../../../../core/services/payment-gateway.service';
import { NotificationService } from '../../../../core/services/notification.service';

export interface IPaymentRequestContext {
  orderId: string;
  orderRef: string;
  totalAmount: number;
  currency: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  interactionId?: string;
  channel?: string;
}

@Component({
  selector: 'app-request-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './request-payment-modal.component.html',
  styleUrls: ['./request-payment-modal.component.scss']
})
export class RequestPaymentModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input() open = false;
  @Input() context: IPaymentRequestContext | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() paymentCreated = new EventEmitter<IPayment>();

  private destroy$ = new Subject<void>();

  integrations: IPaymentIntegration[] = [];
  loadingIntegrations = false;
  noGatewayConnected = false;

  // Form state
  selectedIntegrationId: string = '';
  description = '';
  submitting = false;

  // Result state
  payment: IPayment | null = null;
  paymentCreatedNew = false;
  linkCopied = false;

  constructor(
    private gatewayService: PaymentGatewayService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.open) this.init();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.init();
    }
    if (changes['open']?.currentValue === false) {
      this.reset();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private init(): void {
    this.loadIntegrations();
    if (this.context) {
      this.description = `Payment for order ${this.context.orderRef || ''}`.trim();
    }
  }

  private reset(): void {
    this.payment = null;
    this.paymentCreatedNew = false;
    this.linkCopied = false;
    this.description = '';
    this.selectedIntegrationId = '';
    this.submitting = false;
  }

  loadIntegrations(): void {
    this.loadingIntegrations = true;
    this.gatewayService
      .listGateways()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.integrations = res.integrations.filter((i) => i.status === 'connected');
          const defaultGateway = this.integrations.find((i) => i.isDefault) || this.integrations[0];
          this.selectedIntegrationId = defaultGateway?._id || '';
          this.noGatewayConnected = this.integrations.length === 0;
          this.loadingIntegrations = false;
        },
        error: () => {
          this.loadingIntegrations = false;
          this.noGatewayConnected = true;
        }
      });
  }

  close(): void {
    this.closed.emit();
  }

  formatAmount(amount: number, currency: string): string {
    const symbol = currency === 'INR' ? '₹' : currency;
    return `${symbol}${(amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  getProviderLabel(provider: string): string {
    const map: Record<string, string> = {
      razorpay: 'Razorpay',
      cashfree: 'Cashfree',
      payu: 'PayU',
      phonepe: 'PhonePe',
      stripe: 'Stripe'
    };
    return map[provider] || provider;
  }

  envBadge(env: string): string {
    return env === 'live' ? '🟢 Live' : '🟡 Test';
  }

  submit(): void {
    if (!this.context || this.submitting) return;

    this.submitting = true;
    this.gatewayService
      .createPayment({
        orderId: this.context.orderId,
        amount: this.context.totalAmount,
        currency: this.context.currency || 'INR',
        integrationId: this.selectedIntegrationId || undefined,
        contactId: undefined,
        interactionId: this.context.interactionId,
        channel: this.context.channel || 'manual',
        description: this.description,
        customerName: this.context.contactName,
        customerPhone: this.context.contactPhone,
        customerEmail: this.context.contactEmail
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.payment = res.payment;
          this.paymentCreatedNew = res.created;
          this.paymentCreated.emit(res.payment);
          if (!res.created) {
            this.notification.info(
              'Active payment exists',
              'An unpaid payment link already exists for this order and amount.'
            );
          }
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.error || 'Failed to create payment request.';
          if (err?.error?.code === 'NO_INTEGRATION') {
            this.notification.error('No gateway', 'Connect a payment gateway in Settings → Payment Gateways first.');
          } else {
            this.notification.error('Payment request failed', msg);
          }
        }
      });
  }

  copyLink(): void {
    const url = this.payment?.paymentUrl || this.payment?.shortUrl;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopied = true;
      setTimeout(() => (this.linkCopied = false), 2000);
    });
  }

  isExpired(): boolean {
    if (!this.payment?.expiresAt) return false;
    return new Date(this.payment.expiresAt) < new Date();
  }

  statusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      created: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      authorized: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      expired: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    };
    return map[status] || map['created'];
  }
}
