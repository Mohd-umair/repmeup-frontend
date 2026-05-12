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

  constructor(private http: HttpClient) {}

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
        // Step 1 — create subscription on backend
        const createRes: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/create-subscription`, { planId: options.planId })
        );

        if (!createRes?.success) {
          return reject(createRes?.error || 'Could not initiate payment. Please try again.');
        }

        const { subscriptionId, keyId } = createRes.data;

        // Step 2 — open Razorpay checkout
        if (typeof Razorpay === 'undefined') {
          return reject('Razorpay SDK not loaded. Please refresh the page and try again.');
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
                  planId: options.planId
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
