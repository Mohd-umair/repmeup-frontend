import { Injectable } from '@angular/core';

export interface PlanIntent {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  /** When the choice was made, epoch ms — used to expire stale intents. */
  savedAt: number;
}

const STORAGE_KEY = 'repmeup.planIntent';

/**
 * Remembers which plan a visitor picked on the public pricing page so the choice
 * survives sign-up.
 *
 * Query params cannot carry it: registration routes through email verification, and the
 * customer returns by clicking a link in their inbox — a fresh navigation with no state.
 * So the intent is persisted locally and picked up once they are inside the app.
 *
 * It is a HINT, never an entitlement: it only pre-selects a plan and a billing cycle in
 * the UI. Nothing is charged without the customer completing checkout.
 */
@Injectable({ providedIn: 'root' })
export class PlanIntentService {
  /** Stale intents are dropped — someone returning weeks later has moved on. */
  private readonly MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  remember(planId: string, billingCycle: 'monthly' | 'yearly'): void {
    if (!planId) return;
    const intent: PlanIntent = {
      planId: String(planId).trim().toLowerCase(),
      billingCycle: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
    } catch {
      // Private browsing / storage disabled — the journey still works, it just
      // forgets the choice. Never break the CTA over this.
    }
  }

  /** The stored choice, or null when absent, malformed or expired. */
  peek(): PlanIntent | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PlanIntent;
      if (!parsed?.planId) return null;
      if (Date.now() - (parsed.savedAt || 0) > this.MAX_AGE_MS) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }
}
