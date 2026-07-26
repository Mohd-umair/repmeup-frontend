import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * A single option in a premium dropdown.
 * `icon` = emoji glyph, `iconClass` = Font Awesome classes (e.g. 'fas fa-flag').
 * `colorClass` tints the icon (and selected label) with a Tailwind text color.
 */
export interface PremiumSelectOption {
  value: string;
  label: string;
  icon?: string;
  iconClass?: string;
  colorClass?: string;
  disabled?: boolean;
}

/**
 * PremiumSelect — a reusable, accessible, premium-styled single-select dropdown.
 *
 * Replaces native `<select>` with a custom trigger + floating panel (icons, check
 * marks, hover states, dark mode, entrance animation). Value-driven: the parent
 * owns `value`; the component emits `valueChange` on pick. For "action" selects
 * that should always show the placeholder (e.g. "Change status…"), keep `value`
 * as '' in the parent — the component simply re-shows the placeholder.
 *
 * Built for the inbox first; intended to be reused app-wide.
 */
@Component({
  selector: 'app-premium-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium-select.component.html',
  styleUrls: ['./premium-select.component.scss']
})
export class PremiumSelectComponent {
  @Input() options: PremiumSelectOption[] = [];
  @Input() value: string | null = null;
  @Input() placeholder = 'Select…';
  /** Optional caption rendered above the trigger. */
  @Input() label = '';
  /** Optional leading Font Awesome icon shown inside the trigger. */
  @Input() leadingIcon = '';
  @Input() emptyText = 'No options';
  @Input() disabled = false;
  @Input() fullWidth = true;
  /** Panel horizontal alignment relative to the trigger. */
  @Input() align: 'left' | 'right' = 'left';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  open = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  get triggerSizeClasses(): string {
    switch (this.size) {
      case 'sm':
        return 'px-2.5 py-1.5 text-xs rounded-lg';
      case 'lg':
        return 'px-3.5 py-3.5 text-sm rounded-xl';
      default:
        return 'px-3 py-2.5 text-sm rounded-xl';
    }
  }

  selectedOption(): PremiumSelectOption | null {
    if (this.value == null || this.value === '') return null;
    return this.options.find((o) => o.value === this.value) ?? null;
  }

  isSelected(opt: PremiumSelectOption): boolean {
    return this.value != null && this.value !== '' && this.value === opt.value;
  }

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
  }

  select(opt: PremiumSelectOption): void {
    if (opt.disabled) return;
    this.valueChange.emit(opt.value);
    this.open = false;
  }

  trackByValue(_i: number, opt: PremiumSelectOption): string {
    return opt.value;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (this.host.nativeElement.contains(ev.target as Node)) return;
    this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
