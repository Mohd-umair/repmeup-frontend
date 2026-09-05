import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PremiumMultiselectOption {
  value: string;
  label: string;
  icon?: string;
  iconClass?: string;
  colorClass?: string;
  disabled?: boolean;
  disabledHint?: string;
}

/** Inbox-style multiselect dropdown — reusable app-wide (matches app-premium-select). */
@Component({
  selector: 'app-premium-multiselect-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium-multiselect-filter.component.html',
  styleUrls: ['./premium-multiselect-filter.component.scss']
})
export class PremiumMultiselectFilterComponent {
  @Input() label = '';
  @Input() options: PremiumMultiselectOption[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder = 'Any';
  @Output() selectedChange = new EventEmitter<string[]>();

  open = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (this.host.nativeElement.contains(ev.target as Node)) return;
    this.open = false;
  }

  toggleOpen(): void {
    this.open = !this.open;
  }

  toggleValue(value: string, ev: Event): void {
    ev.stopPropagation();
    const opt = this.options.find((x) => x.value === value);
    if (opt?.disabled) return;
    const set = new Set(this.selected);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    this.selectedChange.emit([...set]);
  }

  isSelected(value: string): boolean {
    return this.selected.includes(value);
  }

  summary(): string {
    const n = this.selected.length;
    if (n === 0) return this.placeholder;
    if (n === 1) {
      const o = this.options.find((x) => x.value === this.selected[0]);
      return o?.label ?? this.selected[0];
    }
    return `${n} selected`;
  }

  clear(ev: Event): void {
    ev.stopPropagation();
    this.selectedChange.emit([]);
  }
}
