import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const SKIP_LOADER_HEADER = new HttpHeaders({ 'X-Skip-Loader': 'true' });

/**
 * API Service - Single Responsibility Principle
 * Handles all HTTP communication with the backend
 */
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: any): Observable<T> {
    const httpParams = this.buildParams(params);
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, { params: httpParams });
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, body);
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.apiUrl}${endpoint}`, body);
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.apiUrl}${endpoint}`);
  }

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.apiUrl}${endpoint}`, body);
  }

  /**
   * Silent GET — skips the global loader (use for background polling)
   */
  getSilent<T>(endpoint: string, params?: any): Observable<T> {
    const httpParams = this.buildParams(params);
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, {
      params: httpParams,
      headers: SKIP_LOADER_HEADER
    });
  }

  /**
   * Silent POST — skips the global loader (use for background sync)
   */
  postSilent<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, body, {
      headers: SKIP_LOADER_HEADER
    });
  }

  /**
   * GET a binary file (CSV export) using the same auth interceptor as JSON.
   */
  getBlob(endpoint: string, params?: any): Observable<Blob> {
    const httpParams = this.buildParams(params);
    return this.http.get(`${this.apiUrl}${endpoint}`, {
      params: httpParams,
      responseType: 'blob'
    });
  }

  /**
   * POST with FormData (file uploads) — does NOT set Content-Type so the
   * browser can include the multipart boundary automatically.
   */
  postForm<T>(endpoint: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.apiUrl}${endpoint}`, formData);
  }

  /**
   * Build HTTP params from object
   */
  private buildParams(params?: any): HttpParams {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        const val = params[key];
        if (val === null || val === undefined) return;
        if (Array.isArray(val)) {
          const joined = val.filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(',');
          if (joined) httpParams = httpParams.set(key, joined);
          return;
        }
        const s = String(val).trim();
        if (s !== '') httpParams = httpParams.set(key, s);
      });
    }
    
    return httpParams;
  }
}

