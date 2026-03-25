import { Injectable, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private readonly STORAGE_KEY = 'orm-theme';
  private mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  readonly isDark = signal(this.resolveIsDark());

  constructor() {
    this.mediaQuery?.addEventListener('change', () => {
      if (this.getStored() === 'system') {
        this.apply();
      }
    });
  }

  toggle(): void {
    const next: ThemeMode = this.isDark() ? 'light' : 'dark';
    localStorage.setItem(this.STORAGE_KEY, next);
    this.apply();
  }

  setMode(mode: ThemeMode): void {
    localStorage.setItem(this.STORAGE_KEY, mode);
    this.apply();
  }

  getMode(): ThemeMode {
    return this.getStored();
  }

  private getStored(): ThemeMode {
    const v = localStorage.getItem(this.STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    return 'light';
  }

  private resolveIsDark(): boolean {
    const mode = this.getStored();
    if (mode === 'light') return false;
    if (mode === 'dark') return true;
    return this.mediaQuery?.matches ?? false;
  }

  private apply(): void {
    const dark = this.resolveIsDark();
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }
}
