import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ISocialAccount {
  _id: string;
  organization: string;
  platform: string;
  platformUsername: string;
  platformUserId: string;
  platformPageId?: string;
  status: 'available' | 'connected' | 'disconnected' | 'error' | 'token_expired';
  usesAccountSlot: boolean;
  connectedAt?: Date;
  disconnectedAt?: Date;
  metadata?: {
    type?: string;
    parentConnection?: any;
    accountType?: string;
    profilePicture?: string;
    followerCount?: number;
    isVerified?: boolean;
  };
  platformData?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountsGrouped {
  connected: ISocialAccount[];
  available: ISocialAccount[];
  disconnected: ISocialAccount[];
  error: ISocialAccount[];
}

@Injectable({
  providedIn: 'root'
})
export class SocialAccountsService {
  private apiUrl = `${environment.apiUrl}/social-accounts`;
  private accountsSubject = new BehaviorSubject<IAccountsGrouped | null>(null);
  public accounts$ = this.accountsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get available (authenticated but not connected) accounts
   */
  getAvailableAccounts(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/available`);
  }

  /**
   * Get all accounts grouped by status
   */
  getAccountsGrouped(): Observable<any> {
    return this.http.get<any>(this.apiUrl).pipe(
      tap(response => {
        if (response.success) {
          this.accountsSubject.next(response.data.grouped);
        }
      })
    );
  }

  /**
   * Connect an available account
   */
  connectAccount(accountId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${accountId}/connect`, {}).pipe(
      tap(() => {
        // Refresh accounts after connection
        this.getAccountsGrouped().subscribe();
      })
    );
  }

  /**
   * Disconnect a connected account
   */
  disconnectAccount(accountId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${accountId}/disconnect`, {}).pipe(
      tap(() => {
        // Refresh accounts after disconnection
        this.getAccountsGrouped().subscribe();
      })
    );
  }

  /**
   * Reconnect a disconnected account
   */
  reconnectAccount(accountId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${accountId}/reconnect`, {}).pipe(
      tap(() => {
        // Refresh accounts after reconnection
        this.getAccountsGrouped().subscribe();
      })
    );
  }
}
