import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface IChannelOption {
  key: string;
  label: string;
  icon: string;
  iconClass?: string;
}

export const ALL_CHANNELS: IChannelOption[] = [
  { key: 'instagram', label: 'Instagram', icon: 'fab fa-instagram', iconClass: 'text-pink-500' },
  { key: 'facebook', label: 'Facebook', icon: 'fab fa-facebook', iconClass: 'text-blue-600' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp', iconClass: 'text-emerald-500' },
  { key: 'google', label: 'Google', icon: 'fab fa-google', iconClass: 'text-red-500' },
  { key: 'youtube', label: 'YouTube', icon: 'fab fa-youtube', iconClass: 'text-red-600' },
  { key: 'email', label: 'Email', icon: 'fas fa-envelope', iconClass: 'text-blue-500' },
];

@Component({
  selector: 'app-automation-channel-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap gap-4">
      <button
        *ngFor="let ch of channels"
        type="button"
        (click)="toggle(ch.key)"
        [class]="isSelected(ch.key)
          ? 'inline-flex items-center gap-3 min-h-[3.25rem] px-6 py-4 rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text-primary)] text-base font-semibold transition-all shadow-sm'
          : 'inline-flex items-center gap-3 min-h-[3.25rem] px-6 py-4 rounded-xl border-2 border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-muted)] text-base font-semibold transition-all hover:border-[var(--text-muted)]'">
        <i [class]="ch.icon + ' text-xl shrink-0'" [ngClass]="isSelected(ch.key) ? ch.iconClass : 'opacity-50'"></i>
        <span>{{ ch.label }}</span>
      </button>
    </div>
  `
})
export class AutomationChannelToggleComponent {
  @Input() channels: IChannelOption[] = ALL_CHANNELS;
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  isSelected(key: string): boolean {
    return this.selected.includes(key);
  }

  toggle(key: string): void {
    const copy = [...this.selected];
    const idx = copy.indexOf(key);
    if (idx >= 0) copy.splice(idx, 1);
    else copy.push(key);
    this.selectedChange.emit(copy);
  }
}
