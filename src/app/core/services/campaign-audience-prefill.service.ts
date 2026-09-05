import { Injectable } from '@angular/core';
import { IFilterQuery } from '../models/contact.model';

const STORAGE_KEY = 'rep_campaign_audience_prefill';

/** Payload passed from Contacts → WhatsApp Campaign editor (session-scoped). */
export interface CampaignAudiencePrefill {
  contactIds?: string[];
  filterQuery?: IFilterQuery;
  search?: string;
  platform?: string;
  tag?: string;
  /** Human-readable label for UI, e.g. "12 selected contacts" */
  sourceLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignAudiencePrefillService {
  set(prefill: CampaignAudiencePrefill): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
    } catch {
      /* quota / private mode — best effort */
    }
  }

  /** Read and remove — one-time handoff. */
  consume(): CampaignAudiencePrefill | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CampaignAudiencePrefill;
    } catch {
      return null;
    }
  }

  peek(): CampaignAudiencePrefill | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CampaignAudiencePrefill) : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
