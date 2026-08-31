import { Injectable } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';
import { FacebookSdkService } from './facebook-sdk.service';
import {
  COMING_SOON_PLATFORM_LABEL,
  COMING_SOON_PLATFORM_MESSAGE,
  isComingSoonPlatform
} from '../constants/platform-availability.constants';

/**
 * Posted from the OAuth popup (/whatsapp-oauth-callback) to the opener tab.
 */
export const WHATSAPP_OAUTH_POSTMESSAGE_TYPE = 'repmeup-whatsapp-oauth';

/**
 * Embedded Signup configuration served by the backend.
 * `solutionId` is non-null only when the platform is set up as an Interakt tech
 * partner — its presence is what selects the SDK flow over the redirect popup.
 */
export interface WhatsAppEmbeddedSignupConfig {
  appId: string | null;
  configId: string | null;
  solutionId: string | null;
  graphVersion?: string;
}

export interface WhatsAppConnectInit {
  authUrl: string;
  embeddedSignup: WhatsAppEmbeddedSignupConfig;
}

export interface WhatsAppEmbeddedSignupResult {
  success: boolean;
  error?: string;
  data?: {
    connectionId: string;
    phoneNumberId: string;
    wabaId: string;
    displayPhoneNumber?: string;
    interakt?: { registered: boolean; webhookConfigured: boolean; error: string | null };
  };
}

export interface WhatsAppOAuthPopupResult {
  /** True after Meta returned success (may be absent if popup closed manually). */
  success: boolean;
  count?: number;
  /** User-visible error message from Graph / signup. */
  error?: string;
  /** Popup closed without notifying (user cancelled). */
  cancelled?: boolean;
}

/**
 * Platform Service - Single Responsibility Principle
 * Handles platform connection management
 */

export interface PlatformConnection {
  _id: string;
  platform: string;
  platformUserId: string;
  platformUsername?: string;
  platformDisplayName?: string;
  platformProfilePicture?: string;
  platformEmail?: string;
  platformData?: any;
  status: 'connected' | 'disconnected' | 'error';
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConnectionResponse {
  success: boolean;
  data: PlatformConnection[];
}

export interface SinglePlatformConnectionResponse {
  success: boolean;
  data: PlatformConnection;
}

export interface AuthorizationUrlResponse {
  success: boolean;
  data: {
    authorizationUrl: string;
    state: string;
  };
}

export interface SyncResponse {
  success: boolean;
  message: string;
  data?: {
    interactionsAdded: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class PlatformService {
  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
    private facebookSdk: FacebookSdkService
  ) {}

  /**
   * Get authorization URL for Google OAuth
   * @param type - 'reviews' for Google Business Profile or 'youtube' for YouTube
   */
  getGoogleAuthorizationUrl(type: 'reviews' | 'youtube' = 'reviews'): Observable<AuthorizationUrlResponse> {
    return this.apiService.get<AuthorizationUrlResponse>(`/platforms/google/connect`, { type });
  }

  /**
   * Get all platform connections for the current organization
   */
  getPlatformConnections(): Observable<PlatformConnectionResponse> {
    return this.apiService.get<PlatformConnectionResponse>('/platforms');
  }

  /**
   * Get a single platform connection
   */
  getPlatformConnection(id: string): Observable<SinglePlatformConnectionResponse> {
    return this.apiService.get<SinglePlatformConnectionResponse>(`/platforms/${id}`);
  }

  /**
   * Disconnect a platform
   */
  disconnectPlatform(id: string): Observable<{ success: boolean; message: string }> {
    return this.apiService.delete<{ success: boolean; message: string }>(`/platforms/${id}`);
  }

  /**
   * Manually sync platform data
   */
  syncPlatform(id: string): Observable<SyncResponse> {
    return this.apiService.post<SyncResponse>(`/platforms/${id}/sync`, {});
  }

  /** Same as syncPlatform but skips the global loader (for background auto-sync) */
  syncPlatformSilent(id: string): Observable<SyncResponse> {
    return this.apiService.postSilent<SyncResponse>(`/platforms/${id}/sync`, {});
  }

  /**
   * Initiate Google OAuth flow
   * Redirects user to Google authorization page
   */
  connectGoogle(type: 'reviews' | 'youtube' = 'reviews'): void {
    if (type === 'reviews' && isComingSoonPlatform('google')) {
      this.notificationService.info(COMING_SOON_PLATFORM_LABEL, COMING_SOON_PLATFORM_MESSAGE);
      return;
    }
    this.getGoogleAuthorizationUrl(type).subscribe({
      next: (response) => {
        if (response.success && response.data.authorizationUrl) {
          // Redirect to Google OAuth page
          window.location.href = response.data.authorizationUrl;
        }
      },
      error: (error) => {
        console.error('Error getting authorization URL:', error);
        this.notificationService.error(
          'Connection Failed',
          'Failed to initiate Google connection. Please try again.'
        );
      }
    });
  }

  /**
   * Initiate Instagram OAuth flow
   * Redirects user to Instagram/Meta authorization page
   * @param forceConsentScreen If true, adds auth_type=reauthorize so Meta shows the permission consent screen (for App Review screencast)
   */
  connectInstagram(forceConsentScreen = false): void {
    const params = forceConsentScreen ? { auth_type: 'reauthorize' } : undefined;
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/instagram', params).subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          // Redirect to Instagram OAuth page
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Instagram authorization URL:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to initiate Instagram connection. Please try again.';
        this.notificationService.error(
          'Connection Failed',
          errorMessage
        );
      }
    });
  }

  /**
   * Initiate Instagram Direct connect flow (Instagram API with Facebook Login).
   * Redirects user to the Facebook OAuth dialog with Instagram scopes.
   * On completion, all Instagram Professional accounts linked to the user's
   * Facebook Pages are saved automatically — no Page Manager step required.
   */
  connectInstagramDirect(): void {
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/instagram-direct').subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Instagram Direct authorization URL:', error);
        const errorMessage =
          error.error?.error || error.error?.message || 'Failed to initiate Instagram connection. Please try again.';
        this.notificationService.error('Connection Failed', errorMessage);
      }
    });
  }

  /**
   * Initiate Instagram Login OAuth flow (no Facebook account required).
   * Uses "Instagram API with Instagram Login" — users log in with Instagram credentials directly.
   */
  connectInstagramLogin(): void {
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/instagram-login').subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Instagram Login authorization URL:', error);
        const errorMessage =
          error.error?.error || error.error?.message || 'Failed to initiate Instagram connection. Please try again.';
        this.notificationService.error('Connection Failed', errorMessage);
      }
    });
  }

  /**
   * Initiate Facebook OAuth flow
   * Redirects user to Facebook/Meta authorization page
   * @param forceConsentScreen If true, adds auth_type=reauthorize so Meta shows the permission consent screen (for App Review screencast)
   */
  connectFacebook(forceConsentScreen = false): void {
    const params = forceConsentScreen ? { auth_type: 'reauthorize' } : undefined;
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/facebook', params).subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting Facebook authorization URL:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to initiate Facebook connection. Please try again.';
        this.notificationService.error(
          'Connection Failed',
          errorMessage
        );
      }
    });
  }

  /**
   * Initiate LinkedIn OAuth flow
   */
  connectLinkedIn(): void {
    if (isComingSoonPlatform('linkedin')) {
      this.notificationService.info(COMING_SOON_PLATFORM_LABEL, COMING_SOON_PLATFORM_MESSAGE);
      return;
    }
    this.apiService.get<{ success: boolean; authUrl: string }>('/auth/linkedin').subscribe({
      next: (response) => {
        if (response.success && response.authUrl) {
          // Redirect to LinkedIn OAuth page
          window.location.href = response.authUrl;
        }
      },
      error: (error) => {
        console.error('Error getting LinkedIn authorization URL:', error);
        const errorMessage = error.error?.error || error.error?.message || 'Failed to initiate LinkedIn connection. Please try again.';
        this.notificationService.error(
          'Connection Failed',
          errorMessage
        );
      }
    });
  }

  /**
   * Initiate WhatsApp Embedded Signup OAuth — returns authUrl for popup/redirect.
   * Backend builds Facebook Login URL with `config_id` (META_WHATSAPP_CONFIG_ID), matching Meta’s
   * onboarding setup for https://business.facebook.com/messaging/whatsapp/onboard/?app_id=…&config_id=…
   * @see https://developers.facebook.com/docs/whatsapp/embedded-signup
   */
  initiateWhatsAppConnection(): Observable<{ success: boolean; data: WhatsAppConnectInit }> {
    return this.apiService.get<{ success: boolean; data: WhatsAppConnectInit }>('/platforms/whatsapp/connect');
  }

  /**
   * Complete Embedded Signup using the Facebook JS SDK.
   *
   * This is the path Meta documents for Tech Providers: `extras.setup.solutionID`
   * attaches the new WABA to our partner solution, and `sessionInfoVersion: 3` makes
   * the SDK post back the waba_id and phone_number_id directly — so the backend does
   * not have to rediscover them through debug_token.
   *
   * Falls back to the redirect popup when the server reports no solution id, which is
   * the case for a plain Meta-direct deployment.
   */
  async connectWhatsAppEmbeddedSignup(cfg: WhatsAppEmbeddedSignupConfig): Promise<WhatsAppEmbeddedSignupResult> {
    if (!cfg.appId) throw new Error('WhatsApp signup is not configured (missing app id).');
    if (!cfg.configId) throw new Error('WhatsApp signup is not configured (missing config id).');

    const FB = await this.facebookSdk.load(cfg.appId, cfg.graphVersion || 'v23.0');

    // The SDK reports the selected WABA/number over postMessage, separately from the
    // login callback that carries the code. Collect both, then resolve.
    let sessionInfo: { wabaId?: string; phoneNumberId?: string } = {};

    const onMessage = (ev: MessageEvent) => {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (payload.event === 'FINISH' || payload.event === 'FINISH_ONLY_WABA') {
          sessionInfo = {
            wabaId: payload.data?.waba_id,
            phoneNumberId: payload.data?.phone_number_id
          };
        }
      } catch {
        /* not a signup message — ignore */
      }
    };
    window.addEventListener('message', onMessage);

    try {
      const code = await new Promise<string>((resolve, reject) => {
        FB.login(
          (response) => {
            const c = response?.authResponse?.code;
            if (c) resolve(c);
            else reject(new Error('WhatsApp signup was cancelled before it completed.'));
          },
          {
            config_id: cfg.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: { solutionID: cfg.solutionId },
              featureType: '',
              sessionInfoVersion: '3'
            }
          }
        );
      });

      if (!sessionInfo.wabaId || !sessionInfo.phoneNumberId) {
        throw new Error(
          'Signup finished but Meta did not return the WhatsApp account details. Please try again.'
        );
      }

      return await firstValueFrom(
        this.apiService.post<WhatsAppEmbeddedSignupResult>('/platforms/whatsapp/embedded-signup', {
          code,
          wabaId: sessionInfo.wabaId,
          phoneNumberId: sessionInfo.phoneNumberId
        })
      );
    } finally {
      window.removeEventListener('message', onMessage);
    }
  }

  /**
   * Open WhatsApp Embedded Signup in a popup window.
   * Resolves after the popup notifies via postMessage (/whatsapp-oauth-callback), or closes.
   */
  connectWhatsAppOAuth(): Promise<WhatsAppOAuthPopupResult> {
    return new Promise((resolve, reject) => {
      let popup: Window | null = null;
      let timer: ReturnType<typeof setInterval> | null = null;
      let finished = false;

      const finalize = () => {
        if (timer != null) {
          clearInterval(timer);
          timer = null;
        }
        window.removeEventListener('message', onMessage as (e: MessageEvent) => void);
      };

      const onMessage = (ev: MessageEvent) => {
        if (finished) return;
        if (ev.origin !== window.location.origin) return;
        const d = ev.data;
        if (!d || d.type !== WHATSAPP_OAUTH_POSTMESSAGE_TYPE) return;
        finished = true;
        finalize();
        try {
          if (popup && !popup.closed) {
            popup.close();
          }
        } catch {
          /* ignore — some browsers sandbox cross-window close */
        }
        resolve({
          success: !!d.success,
          count: d.count != null ? Number(d.count) : undefined,
          error: typeof d.error === 'string' ? d.error : undefined
        });
      };

      window.addEventListener('message', onMessage as (e: MessageEvent) => void);

      this.initiateWhatsAppConnection().subscribe({
        next: (response) => {
          if (!response?.data?.authUrl) {
            finalize();
            reject(new Error('No auth URL returned from server'));
            return;
          }
          popup = window.open(
            response.data.authUrl,
            'whatsapp_oauth',
            'width=700,height=700,scrollbars=yes,resizable=yes'
          );
          if (!popup) {
            finalize();
            reject(new Error('Popup blocked. Please allow popups for this site.'));
            return;
          }
          timer = setInterval(() => {
            if (finished) return;
            if (popup?.closed) {
              finished = true;
              finalize();
              resolve({ success: false, cancelled: true });
            }
          }, 400);
        },
        error: (err) => {
          finalize();
          reject(err);
        }
      });
    });
  }

  /**
   * Connect WhatsApp using direct env credentials (dev/fallback — single-tenant).
   */
  connectWhatsApp(): Observable<SinglePlatformConnectionResponse> {
    return this.apiService.post<SinglePlatformConnectionResponse>('/platforms/whatsapp/connect-direct', {});
  }

  /**
   * Disconnect WhatsApp Business API
   * @param connectionId  Optional — disconnect a specific connection ID
   */
  disconnectWhatsApp(connectionId?: string): Observable<{ success: boolean; message: string }> {
    const url = connectionId
      ? `/platforms/whatsapp/disconnect?connectionId=${connectionId}`
      : '/platforms/whatsapp/disconnect';
    return this.apiService.delete<{ success: boolean; message: string }>(url);
  }

  /**
   * Get WhatsApp connection status
   */
  getWhatsAppStatus(): Observable<any> {
    return this.apiService.get<any>('/platforms/whatsapp/status');
  }
}


