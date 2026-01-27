import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Theme Service - Dynamic Platform Theming
 * Manages platform-specific color themes for the inbox
 */

export interface PlatformTheme {
  platform: string;
  primaryColor: string;
  secondaryColor: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  icon: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentThemeSubject!: BehaviorSubject<PlatformTheme>;
  public currentTheme$!: any;

  private platformThemes: { [key: string]: PlatformTheme } = {
    instagram: {
      platform: 'instagram',
      primaryColor: '#E4405F',
      secondaryColor: '#833AB4',
      gradientFrom: '#833AB4',
      gradientTo: '#FD1D1D',
      accentColor: '#E4405F',
      textColor: '#262626',
      backgroundColor: '#FAFAFA',
      borderColor: '#E4405F',
      icon: 'fab fa-instagram',
      name: 'Instagram'
    },
    facebook: {
      platform: 'facebook',
      primaryColor: '#1877F2',
      secondaryColor: '#0C63D4',
      gradientFrom: '#1877F2',
      gradientTo: '#0C63D4',
      accentColor: '#1877F2',
      textColor: '#1C1E21',
      backgroundColor: '#F0F2F5',
      borderColor: '#1877F2',
      icon: 'fab fa-facebook',
      name: 'Facebook'
    },
    youtube: {
      platform: 'youtube',
      primaryColor: '#FF0000',
      secondaryColor: '#CC0000',
      gradientFrom: '#FF0000',
      gradientTo: '#CC0000',
      accentColor: '#FF0000',
      textColor: '#0F0F0F',
      backgroundColor: '#F9F9F9',
      borderColor: '#FF0000',
      icon: 'fab fa-youtube',
      name: 'YouTube'
    },
    google: {
      platform: 'google',
      primaryColor: '#4285F4',
      secondaryColor: '#34A853',
      gradientFrom: '#4285F4',
      gradientTo: '#34A853',
      accentColor: '#4285F4',
      textColor: '#202124',
      backgroundColor: '#F8F9FA',
      borderColor: '#4285F4',
      icon: 'fab fa-google',
      name: 'Google Business'
    },
    linkedin: {
      platform: 'linkedin',
      primaryColor: '#0A66C2',
      secondaryColor: '#004182',
      gradientFrom: '#0A66C2',
      gradientTo: '#004182',
      accentColor: '#0A66C2',
      textColor: '#000000',
      backgroundColor: '#F3F2EF',
      borderColor: '#0A66C2',
      icon: 'fab fa-linkedin',
      name: 'LinkedIn'
    },
    whatsapp: {
      platform: 'whatsapp',
      primaryColor: '#25D366',
      secondaryColor: '#128C7E',
      gradientFrom: '#25D366',
      gradientTo: '#128C7E',
      accentColor: '#25D366',
      textColor: '#111B21',
      backgroundColor: '#E9EDEF',
      borderColor: '#25D366',
      icon: 'fab fa-whatsapp',
      name: 'WhatsApp'
    },
    default: {
      platform: 'default',
      primaryColor: '#D0FF00',
      secondaryColor: '#B8E600',
      gradientFrom: '#D0FF00',
      gradientTo: '#B8E600',
      accentColor: '#D0FF00',
      textColor: '#000000',
      backgroundColor: '#FFFFFF',
      borderColor: '#D0FF00',
      icon: 'fas fa-comments',
      name: 'All Platforms'
    }
  };

  constructor() {
    // Initialize after platformThemes is defined
    this.currentThemeSubject = new BehaviorSubject<PlatformTheme>(this.getDefaultTheme());
    this.currentTheme$ = this.currentThemeSubject.asObservable();
  }

  /**
   * Set theme based on platform
   */
  setPlatformTheme(platform: string | null): void {
    const theme = platform && this.platformThemes[platform.toLowerCase()]
      ? this.platformThemes[platform.toLowerCase()]
      : this.getDefaultTheme();

    this.currentThemeSubject.next(theme);
    
    // Apply CSS custom properties for dynamic styling
    this.applyThemeToDOM(theme);
  }

  /**
   * Get theme for a specific platform
   */
  getTheme(platform: string): PlatformTheme {
    return this.platformThemes[platform.toLowerCase()] || this.getDefaultTheme();
  }

  /**
   * Get current theme
   */
  getCurrentTheme(): PlatformTheme {
    return this.currentThemeSubject.value;
  }

  /**
   * Get default theme
   */
  private getDefaultTheme(): PlatformTheme {
    return this.platformThemes['default'];
  }

  /**
   * Apply theme to DOM using CSS custom properties
   */
  private applyThemeToDOM(theme: PlatformTheme): void {
    const root = document.documentElement;
    
    root.style.setProperty('--platform-primary', theme.primaryColor);
    root.style.setProperty('--platform-secondary', theme.secondaryColor);
    root.style.setProperty('--platform-gradient-from', theme.gradientFrom);
    root.style.setProperty('--platform-gradient-to', theme.gradientTo);
    root.style.setProperty('--platform-accent', theme.accentColor);
    root.style.setProperty('--platform-text', theme.textColor);
    root.style.setProperty('--platform-bg', theme.backgroundColor);
    root.style.setProperty('--platform-border', theme.borderColor);

    console.log(`🎨 [Theme] Applied ${theme.name} theme`);
  }

  /**
   * Reset to default theme
   */
  resetTheme(): void {
    this.setPlatformTheme(null);
  }

  /**
   * Get all available themes
   */
  getAllThemes(): PlatformTheme[] {
    return Object.values(this.platformThemes).filter(theme => theme.platform !== 'default');
  }
}
