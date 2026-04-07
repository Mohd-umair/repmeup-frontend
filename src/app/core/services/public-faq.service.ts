import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { FaqCategory } from '../../features/faq/faq.model';

export interface PublicFaqLoadResult {
  categories: FaqCategory[];
  /** True when the HTTP request failed (network / server error). */
  loadFailed: boolean;
}

@Injectable({ providedIn: 'root' })
export class PublicFaqService {
  constructor(private http: HttpClient) {}

  /**
   * Public marketing FAQ from API. Content is managed in the database (Super Admin).
   */
  getFaqs(): Observable<PublicFaqLoadResult> {
    return this.http
      .get<{ success: boolean; data: FaqCategory[] }>(`${environment.apiUrl}/public/faqs`)
      .pipe(
        map((res) => {
          const categories =
            res.success && Array.isArray(res.data) ? res.data : [];
          return { categories, loadFailed: false };
        }),
        catchError(() => of({ categories: [], loadFailed: true }))
      );
  }
}
