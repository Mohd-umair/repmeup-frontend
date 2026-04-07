import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ITicket, ITicketListResponse, TicketCategory, TicketPriority } from '../models/ticket.model';

interface IApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface IRaiseTicketPayload {
  subject: string;
  category: TicketCategory;
  description: string;
  priority?: TicketPriority;
}

/** Query params for GET /api/tickets (processed on backend) */
export interface IMyTicketsQuery {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority?: string;
  /** Search subject + description (backend param: q) */
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  constructor(private api: ApiService) {}

  raiseTicket(payload: IRaiseTicketPayload): Observable<IApiResponse<ITicket>> {
    return this.api.post<IApiResponse<ITicket>>('/tickets', payload);
  }

  getMyTickets(query: IMyTicketsQuery = {}): Observable<IApiResponse<ITicketListResponse>> {
    const params: Record<string, any> = {
      page: query.page ?? 1,
      limit: query.limit ?? 20
    };
    if (query.status) params['status'] = query.status;
    if (query.category) params['category'] = query.category;
    if (query.priority) params['priority'] = query.priority;
    if (query.q) params['q'] = query.q;
    return this.api.get<IApiResponse<ITicketListResponse>>('/tickets', params);
  }

  getTicket(id: string): Observable<IApiResponse<ITicket>> {
    return this.api.get<IApiResponse<ITicket>>(`/tickets/${id}`);
  }

  uploadAttachment(ticketId: string, file: File): Observable<IApiResponse<{ url: string; name: string; type: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.api.postForm<IApiResponse<{ url: string; name: string; type: string }>>(
      `/tickets/${ticketId}/attachments`,
      formData
    );
  }
}
