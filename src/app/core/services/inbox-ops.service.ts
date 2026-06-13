import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import {
  ICreateOrderPayload,
  ICreateReviewPayload,
  IOpsComplaintDetail,
  IOpsComplaintRow,
  IOpsComplaintStats,
  IOpsListResult,
  IOpsOrderDetail,
  IOpsOrderRow,
  IOpsOrderStats,
  IOpsReviewDetail,
  IOpsReviewRow,
  IOpsReviewStats
} from '../models/inbox-ops.model';

@Injectable({ providedIn: 'root' })
export class InboxOpsService {
  constructor(private api: ApiService) {}

  listOrders(params?: Record<string, string | number | undefined>): Observable<IOpsListResult<IOpsOrderRow>> {
    return this.api
      .get<IApiResponse<IOpsListResult<IOpsOrderRow>>>('/inbox/ops/orders', params)
      .pipe(map((r) => r.data!));
  }

  getOrderStats(params?: Record<string, string | undefined>): Observable<IOpsOrderStats> {
    return this.api
      .get<IApiResponse<IOpsOrderStats>>('/inbox/ops/orders/stats', params)
      .pipe(map((r) => r.data!));
  }

  getOrderDetail(id: string): Observable<IOpsOrderDetail> {
    return this.api.get<IApiResponse<IOpsOrderDetail>>(`/inbox/ops/orders/${id}`).pipe(map((r) => r.data!));
  }

  /** Resolve the order linked to an inbox conversation (for the "Order placed" chip deep-link). */
  getOrderByInteraction(interactionId: string): Observable<{ id: string; displayRef: string | null; status: string }> {
    return this.api
      .get<IApiResponse<{ id: string; displayRef: string | null; status: string }>>(`/inbox/ops/orders/by-interaction/${interactionId}`)
      .pipe(map((r) => r.data!));
  }

  createOrder(payload: ICreateOrderPayload): Observable<IOpsOrderDetail> {
    return this.api
      .post<IApiResponse<IOpsOrderDetail>>('/inbox/ops/orders', payload)
      .pipe(map((r) => r.data!));
  }

  updateOrderStatus(id: string, status: string, notes?: string): Observable<IOpsOrderDetail> {
    return this.api
      .patch<IApiResponse<IOpsOrderDetail>>(`/inbox/ops/orders/${id}/status`, { status, notes })
      .pipe(map((r) => r.data!));
  }

  listComplaints(params?: Record<string, string | number | undefined>): Observable<IOpsListResult<IOpsComplaintRow>> {
    return this.api
      .get<IApiResponse<IOpsListResult<IOpsComplaintRow>>>('/inbox/ops/complaints', params)
      .pipe(map((r) => r.data!));
  }

  getComplaintStats(): Observable<IOpsComplaintStats> {
    return this.api
      .get<IApiResponse<IOpsComplaintStats>>('/inbox/ops/complaints/stats')
      .pipe(map((r) => r.data!));
  }

  getComplaintDetail(id: string): Observable<IOpsComplaintDetail> {
    return this.api
      .get<IApiResponse<IOpsComplaintDetail>>(`/inbox/ops/complaints/${id}`)
      .pipe(map((r) => r.data!));
  }

  acknowledgeComplaint(id: string, note?: string): Observable<IOpsComplaintDetail> {
    return this.api
      .post<IApiResponse<IOpsComplaintDetail>>(`/inbox/ops/complaints/${id}/acknowledge`, { note })
      .pipe(map((r) => r.data!));
  }

  assignComplaint(id: string, assigneeId: string): Observable<IOpsComplaintDetail> {
    return this.api
      .post<IApiResponse<IOpsComplaintDetail>>(`/inbox/ops/complaints/${id}/assign`, { assigneeId })
      .pipe(map((r) => r.data!));
  }

  resolveComplaint(id: string, note?: string): Observable<IOpsComplaintDetail> {
    return this.api
      .post<IApiResponse<IOpsComplaintDetail>>(`/inbox/ops/complaints/${id}/resolve`, { note })
      .pipe(map((r) => r.data!));
  }

  closeComplaint(id: string): Observable<IOpsComplaintDetail> {
    return this.api
      .post<IApiResponse<IOpsComplaintDetail>>(`/inbox/ops/complaints/${id}/close`, {})
      .pipe(map((r) => r.data!));
  }

  createReview(payload: ICreateReviewPayload): Observable<IOpsReviewDetail> {
    return this.api
      .post<IApiResponse<IOpsReviewDetail>>('/inbox/ops/reviews', payload)
      .pipe(map((r) => r.data!));
  }

  listReviews(params?: Record<string, string | number | undefined>): Observable<IOpsListResult<IOpsReviewRow>> {
    return this.api
      .get<IApiResponse<IOpsListResult<IOpsReviewRow>>>('/inbox/ops/reviews', params)
      .pipe(map((r) => r.data!));
  }

  getReviewStats(): Observable<IOpsReviewStats> {
    return this.api
      .get<IApiResponse<IOpsReviewStats>>('/inbox/ops/reviews/stats')
      .pipe(map((r) => r.data!));
  }

  getReviewDetail(id: string): Observable<IOpsReviewDetail> {
    return this.api
      .get<IApiResponse<IOpsReviewDetail>>(`/inbox/ops/reviews/${id}`)
      .pipe(map((r) => r.data!));
  }

  suggestReviewReply(id: string): Observable<{ content: string; confidence: number }> {
    return this.api
      .post<IApiResponse<{ content: string; confidence: number }>>(`/inbox/ops/reviews/${id}/suggest-reply`, {})
      .pipe(map((r) => r.data!));
  }

  publishReviewReply(id: string, content: string): Observable<IOpsReviewDetail> {
    return this.api
      .post<IApiResponse<IOpsReviewDetail>>(`/inbox/ops/reviews/${id}/reply`, { content })
      .pipe(map((r) => r.data!));
  }
}
