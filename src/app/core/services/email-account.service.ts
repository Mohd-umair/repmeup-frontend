import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface EmailConnection {
  _id: string;
  platformDisplayName: string;
  platformData: {
    emailAddress: string;
    emailProvider: 'gmail' | 'outlook' | 'imap';
    watchExpiry?: string;
    msSubscriptionExpiry?: string;
  };
  status: 'connected' | 'disconnected' | 'error' | 'token_expired';
  lastSyncAt?: string;
  connectedAt?: string;
}

export interface ImapConnectPayload {
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class EmailAccountService {
  constructor(private api: ApiService) {}

  /** List all connected email accounts for the org */
  listConnections(): Observable<{ success: boolean; data: EmailConnection[] }> {
    return this.api.get<{ success: boolean; data: EmailConnection[] }>('/email/accounts');
  }

  /** Redirect to Gmail OAuth (navigates browser, no HTTP call) */
  connectGmail(): void {
    window.location.href = `${environment.apiUrl}/email/connect/gmail`;
  }

  /** Redirect to Outlook OAuth */
  connectOutlook(): void {
    window.location.href = `${environment.apiUrl}/email/connect/outlook`;
  }

  /** Connect via IMAP credentials */
  connectImap(payload: ImapConnectPayload): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>('/email/connect/imap', payload);
  }

  /** Disconnect an email account */
  disconnect(connectionId: string): Observable<{ success: boolean; message: string }> {
    return this.api.delete<{ success: boolean; message: string }>(`/email/${connectionId}`);
  }

  /** Manually renew Gmail watch (admin/debug) */
  refreshGmailWatch(connectionId: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(`/email/${connectionId}/refresh-watch`, {});
  }
}
