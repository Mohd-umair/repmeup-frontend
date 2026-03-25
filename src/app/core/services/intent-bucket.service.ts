import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface IIntentBucket {
  _id: string;
  organization: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  keywords: string[];
  aiPromptHint: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class IntentBucketService {
  private bucketsSubject = new BehaviorSubject<IIntentBucket[]>([]);
  public buckets$ = this.bucketsSubject.asObservable();

  constructor(private api: ApiService) {}

  getBuckets(): Observable<any> {
    return this.api.get<any>('/intent-buckets').pipe(
      tap(res => {
        if (res.success && res.data) {
          this.bucketsSubject.next(res.data);
        }
      })
    );
  }

  createBucket(data: Partial<IIntentBucket>): Observable<any> {
    return this.api.post<any>('/intent-buckets', data);
  }

  updateBucket(id: string, data: Partial<IIntentBucket>): Observable<any> {
    return this.api.put<any>(`/intent-buckets/${id}`, data);
  }

  deleteBucket(id: string): Observable<any> {
    return this.api.delete<any>(`/intent-buckets/${id}`);
  }

  reorderBuckets(order: { id: string; order: number }[]): Observable<any> {
    return this.api.put<any>('/intent-buckets/reorder', { order });
  }

  getCachedBuckets(): IIntentBucket[] {
    return this.bucketsSubject.getValue();
  }
}
