import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IApiResponse } from '../models/api-response.model';
import { IContact, IContactListParams } from '../models/contact.model';

export interface IContactListResponse {
  data: IContact[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly base = '/contacts';

  constructor(private apiService: ApiService) {}

  getContacts(params: IContactListParams = {}): Observable<IContactListResponse & { success: boolean }> {
    const query: Record<string, string> = {};
    if (params.search) query['search'] = params.search;
    if (params.platform) query['platform'] = params.platform;
    if (params.tag) query['tag'] = params.tag;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);

    const qs = Object.keys(query).length
      ? '?' + new URLSearchParams(query).toString()
      : '';
    return this.apiService.get<IContactListResponse & { success: boolean }>(`${this.base}${qs}`);
  }

  getContact(id: string): Observable<IApiResponse<IContact>> {
    return this.apiService.get<IApiResponse<IContact>>(`${this.base}/${id}`);
  }

  updateContact(id: string, data: Partial<Pick<IContact, 'primaryName' | 'primaryPhone' | 'primaryEmail' | 'notes' | 'tags'>>): Observable<IApiResponse<IContact>> {
    return this.apiService.put<IApiResponse<IContact>>(`${this.base}/${id}`, data);
  }

  deleteContact(id: string): Observable<IApiResponse<void>> {
    return this.apiService.delete<IApiResponse<void>>(`${this.base}/${id}`);
  }

  mergeContact(primaryId: string, targetContactId: string): Observable<IApiResponse<IContact>> {
    return this.apiService.post<IApiResponse<IContact>>(`${this.base}/${primaryId}/merge`, { targetContactId });
  }
}
