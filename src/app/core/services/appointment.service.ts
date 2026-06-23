import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  IApptDetail, IApptListResult, IApptStats, IService, IProvider, IAvailability
} from '../models/appointment.model';

interface IApiResponse<T> { success: boolean; data?: T; pagination?: { total: number; page: number; limit: number }; error?: string; }

/**
 * Appointment Booking API client. Talks to /appointments (list/stats/detail/
 * create/status/reschedule/cancel + availability + services/providers CRUD).
 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
  constructor(private api: ApiService) {}

  // ── Appointments ───────────────────────────────────────────────────────────
  list(params: Record<string, any>): Observable<IApptListResult> {
    return this.api.get<IApiResponse<IApptListResult['rows']>>('/appointments', params).pipe(
      map((r) => ({ rows: r.data || [], total: r.pagination?.total || 0, page: r.pagination?.page || 1, limit: r.pagination?.limit || 30 }))
    );
  }

  stats(): Observable<IApptStats> {
    return this.api.get<IApiResponse<IApptStats>>('/appointments/stats').pipe(map((r) => r.data!));
  }

  detail(id: string): Observable<IApptDetail> {
    return this.api.get<IApiResponse<IApptDetail>>(`/appointments/${id}`).pipe(map((r) => r.data!));
  }

  byInteraction(interactionId: string): Observable<{ id: string; displayRef: string | null; status: string; whenLabel: string; serviceName: string | null } | null> {
    return this.api.get<IApiResponse<any>>(`/appointments/by-interaction/${interactionId}`).pipe(map((r) => r.data ?? null));
  }

  create(body: Record<string, any>): Observable<IApptDetail> {
    return this.api.post<IApiResponse<IApptDetail>>('/appointments', body).pipe(map((r) => r.data!));
  }

  updateStatus(id: string, status: string, extra?: Record<string, any>): Observable<IApptDetail> {
    return this.api.patch<IApiResponse<IApptDetail>>(`/appointments/${id}/status`, { status, ...(extra || {}) }).pipe(map((r) => r.data!));
  }

  reschedule(id: string, body: { startAt: string; providerId?: string }): Observable<IApptDetail> {
    return this.api.patch<IApiResponse<IApptDetail>>(`/appointments/${id}/reschedule`, body).pipe(map((r) => r.data!));
  }

  cancel(id: string, reason?: string): Observable<IApptDetail> {
    return this.api.delete<IApiResponse<IApptDetail>>(`/appointments/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`).pipe(map((r) => r.data!));
  }

  // ── Availability ───────────────────────────────────────────────────────────
  availability(serviceId: string, providerId?: string, days = 14): Observable<IAvailability> {
    const params: Record<string, any> = { serviceId, days };
    if (providerId) params['providerId'] = providerId;
    return this.api.get<IApiResponse<IAvailability>>('/appointments/availability', params).pipe(map((r) => r.data!));
  }

  // ── Services ───────────────────────────────────────────────────────────────
  listServices(active = false): Observable<IService[]> {
    return this.api.get<IApiResponse<IService[]>>('/appointments/services', active ? { active: 'all' } : {}).pipe(map((r) => r.data || []));
  }
  createService(body: Partial<IService>): Observable<IService> {
    return this.api.post<IApiResponse<IService>>('/appointments/services', body).pipe(map((r) => r.data!));
  }
  updateService(id: string, body: Partial<IService>): Observable<IService> {
    return this.api.patch<IApiResponse<IService>>(`/appointments/services/${id}`, body).pipe(map((r) => r.data!));
  }
  deleteService(id: string): Observable<unknown> {
    return this.api.delete<IApiResponse<unknown>>(`/appointments/services/${id}`);
  }

  // ── Providers ──────────────────────────────────────────────────────────────
  listProviders(active = false): Observable<IProvider[]> {
    return this.api.get<IApiResponse<IProvider[]>>('/appointments/providers', active ? { active: 'all' } : {}).pipe(map((r) => r.data || []));
  }
  createProvider(body: Partial<IProvider>): Observable<IProvider> {
    return this.api.post<IApiResponse<IProvider>>('/appointments/providers', body).pipe(map((r) => r.data!));
  }
  updateProvider(id: string, body: Partial<IProvider>): Observable<IProvider> {
    return this.api.patch<IApiResponse<IProvider>>(`/appointments/providers/${id}`, body).pipe(map((r) => r.data!));
  }
  deleteProvider(id: string): Observable<unknown> {
    return this.api.delete<IApiResponse<unknown>>(`/appointments/providers/${id}`);
  }
  connectProviderGoogle(id: string): Observable<{ authUrl: string }> {
    return this.api.get<IApiResponse<{ authUrl: string }>>(`/appointments/providers/${id}/google/connect`).pipe(map((r) => r.data!));
  }
  disconnectProviderGoogle(id: string): Observable<unknown> {
    return this.api.delete<IApiResponse<unknown>>(`/appointments/providers/${id}/google`);
  }
}
