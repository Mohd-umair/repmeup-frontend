import { Injectable } from '@angular/core';

/**
 * Minimal shape of the parts of the Facebook JS SDK we use.
 * Typed locally so the app does not need @types/facebook-js-sdk.
 */
interface FbLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}

interface FacebookSdk {
  init(params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(cb: (r: FbLoginResponse) => void, opts: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

/**
 * Loads the Facebook JavaScript SDK on demand.
 *
 * Deliberately NOT added to index.html: the SDK is only needed by WhatsApp
 * Embedded Signup, so every other page would pay for a third-party script it never
 * uses. Loading is idempotent — repeated calls share one in-flight promise.
 */
@Injectable({ providedIn: 'root' })
export class FacebookSdkService {
  private loading: Promise<FacebookSdk> | null = null;
  private initializedAppId: string | null = null;

  /**
   * Resolve with an initialised `window.FB`.
   * @param appId Meta app id (served by the backend, never hardcoded)
   * @param version Graph version for FB.init, e.g. 'v23.0'
   */
  load(appId: string, version = 'v23.0'): Promise<FacebookSdk> {
    if (!appId) return Promise.reject(new Error('Facebook app id is not configured.'));

    // Already initialised for this app — reuse.
    if (window.FB && this.initializedAppId === appId) {
      return Promise.resolve(window.FB);
    }
    if (this.loading) return this.loading;

    this.loading = new Promise<FacebookSdk>((resolve, reject) => {
      const finishInit = () => {
        if (!window.FB) {
          reject(new Error('Facebook SDK loaded but window.FB is unavailable.'));
          return;
        }
        window.FB.init({ appId, cookie: true, xfbml: false, version });
        this.initializedAppId = appId;
        resolve(window.FB);
      };

      // Script already present from an earlier attempt.
      if (document.getElementById('facebook-jssdk')) {
        if (window.FB) {
          finishInit();
        } else {
          window.fbAsyncInit = finishInit;
        }
        return;
      }

      window.fbAsyncInit = finishInit;

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        this.loading = null;
        reject(new Error('Could not load the Facebook SDK. Check your network or ad blocker.'));
      };
      document.body.appendChild(script);
    });

    // Let a later attempt retry after a failure.
    this.loading.catch(() => {
      this.loading = null;
    });

    return this.loading;
  }
}
