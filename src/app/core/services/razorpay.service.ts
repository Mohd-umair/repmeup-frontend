import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RazorpayCheckoutOptions {
  planId: string;
  planName: string;
  /** Price label shown to user e.g. "₹2,499/mo" */
  priceLabel: string;
  /** User's name for prefill */
  userName?: string;
  /** User's email for prefill */
  userEmail?: string;
  /** User's phone for prefill */
  userContact?: string;
}

export interface RazorpayVerifyResult {
  success: boolean;
  message?: string;
  data?: {
    planId: string;
    planName: string;
    status: string;
  };
}

declare const Razorpay: any;

@Injectable({ providedIn: 'root' })
export class RazorpayService {
  private readonly apiUrl = `${environment.apiUrl}/razorpay`;
  private static readonly SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';
  /** Cached so the SDK (and its tracker chunks) load at most once, only on first payment. */
  private sdkPromise: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Inject the Razorpay checkout script on demand. Resolves once `window.Razorpay`
   * is available. Loaded lazily (not globally in index.html) so Razorpay's tracking
   * chunks don't run on every page of the app.
   */
  private loadSdk(): Promise<void> {
    if (typeof Razorpay !== 'undefined') return Promise.resolve();
    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${RazorpayService.SDK_URL}"]`
      );
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject());
        return;
      }
      const script = document.createElement('script');
      script.src = RazorpayService.SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.sdkPromise = null; // allow a retry on next attempt
        reject();
      };
      document.body.appendChild(script);
    });
    return this.sdkPromise;
  }

  /**
   * Full upgrade flow:
   *  1. Create Razorpay subscription on backend
   *  2. Open Razorpay checkout modal
   *  3. On payment success → verify signature on backend
   *  4. Resolve with verify result or reject with error message
   */
  initiateUpgrade(options: RazorpayCheckoutOptions): Promise<RazorpayVerifyResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // Backend stores planId as lowercase slug (starter/pro/business). Never send display name casing.
        const planId = String(options.planId || '').trim().toLowerCase();
        if (!planId) {
          return reject('Invalid plan selected.');
        }

        // Step 1 — create subscription on backend
        const createRes: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/create-subscription`, { planId })
        );

        if (!createRes?.success) {
          return reject(createRes?.error || 'Could not initiate payment. Please try again.');
        }

        const { subscriptionId, keyId } = createRes.data;

        // Step 2 — load the checkout SDK on demand, then open Razorpay checkout
        try {
          await this.loadSdk();
        } catch {
          return reject('Could not load the payment gateway. Please check your connection and try again.');
        }

        const rzp = new Razorpay({
          key: keyId || environment.razorpayKeyId,
          subscription_id: subscriptionId,
          name: 'RepMeUp',
          description: `${options.planName} Plan — ${options.priceLabel}`,
          image: '/assets/Images/logo.jpeg',
          prefill: {
            name: options.userName || '',
            email: options.userEmail || '',
            contact: options.userContact || ''
          },
          theme: { color: '#bef264' },       // rep-lime
          modal: {
            ondismiss: () => reject('Payment cancelled.')
          },
          handler: async (response: any) => {
            // Step 3 — verify on backend
            try {
              const verifyRes: any = await firstValueFrom(
                this.http.post(`${this.apiUrl}/verify`, {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  planId
                })
              );
              resolve(verifyRes);
            } catch (err: any) {
              reject(err?.error?.error || 'Payment verification failed. Please contact support.');
            }
          }
        });

        rzp.open();
      } catch (err: any) {
        reject(err?.error?.error || err?.message || 'Payment could not be started.');
      }
    });
  }
}
