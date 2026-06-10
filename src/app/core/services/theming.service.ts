import { Injectable } from '@angular/core';

export interface IWhiteLabel {
  enabled?: boolean;
  customLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
}

/**
 * ThemingService — applies an organization's white-label branding to the running
 * app: sets CSS custom properties for primary/secondary colors and exposes the
 * custom logo. Called when org context loads/changes (e.g. after an account
 * switch into a branded reseller client).
 */
@Injectable({ providedIn: 'root' })
export class ThemingService {
  private logoUrl: string | null = null;

  /** Apply (or clear) white-label theming. Safe to call repeatedly. */
  apply(whiteLabel: IWhiteLabel | null | undefined): void {
    const root = document.documentElement;

    if (!whiteLabel?.enabled) {
      this.clear();
      return;
    }

    if (whiteLabel.primaryColor) {
      root.style.setProperty('--wl-primary', whiteLabel.primaryColor);
    }
    if (whiteLabel.secondaryColor) {
      root.style.setProperty('--wl-secondary', whiteLabel.secondaryColor);
    }
    this.logoUrl = whiteLabel.customLogo || null;
  }

  /** Remove any applied white-label overrides (default RepMeUp branding). */
  clear(): void {
    const root = document.documentElement;
    root.style.removeProperty('--wl-primary');
    root.style.removeProperty('--wl-secondary');
    this.logoUrl = null;
  }

  /** The active org's custom logo, or null when not branded. */
  getLogoUrl(): string | null {
    return this.logoUrl;
  }
}
