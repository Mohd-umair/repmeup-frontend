import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PricingPageResponse } from '../models/pricing.model';

/**
 * Public pricing data. One call, everything the /pricing page renders.
 * No auth — this is the marketing surface.
 */
@Injectable({ providedIn: 'root' })
export class PricingService {
  constructor(private api: ApiService) {}

  getPricingPage(): Observable<PricingPageResponse> {
    return this.api.get<PricingPageResponse>('/plans/pricing-page');
  }
}
