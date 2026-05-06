import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { WHATSAPP_OAUTH_POSTMESSAGE_TYPE } from '../../core/services/platform.service';

/**
 * Public route hit after WhatsApp Embedded Signup redirect.
 * If opened by window.open from the app: posts result to opener and closes.
 * Otherwise sends the user into settings with the same query hints.
 */
@Component({
  selector: 'app-whatsapp-oauth-result',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 dark:bg-neutral-950">
      <p class="text-center text-neutral-700 dark:text-neutral-200">Returning to RepMeUp…</p>
      <p class="max-w-md text-center text-sm text-neutral-500 dark:text-neutral-400">
        If this tab does not close automatically, close it and return to the settings page.
      </p>
    </div>
  `
})
export class WhatsappOAuthResultComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    void this.run();
  }

  private async run(): Promise<void> {
    const params = await firstValueFrom(this.route.queryParamMap);
    const opener = typeof window !== 'undefined' ? window.opener : null;

    const success = params.get('whatsapp_connected') === 'true';
    const count = params.get('count') ?? undefined;
    const errorRaw = params.get('whatsapp_error');
    const error = errorRaw != null ? decodeURIComponent(errorRaw) : undefined;

    if (opener && opener !== window) {
      opener.postMessage(
        {
          type: WHATSAPP_OAUTH_POSTMESSAGE_TYPE,
          success,
          count,
          error
        },
        window.location.origin
      );
      window.close();
      return;
    }

    await this.router.navigate(['/app/settings/platforms'], {
      queryParams: success
        ? { tab: 'platforms', whatsapp_connected: 'true', ...(count != null ? { count } : {}) }
        : { tab: 'platforms', ...(error != null ? { whatsapp_error: error } : {}) },
      replaceUrl: true
    });
  }
}
