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
  @ViewChild('trigger') trigger?: ElementRef<HTMLButtonElement>;

  open = false;
  panelStyle: { top: string; left: string; width: string } | null = null;

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
    if (this.open) {
      this.updatePanelPosition();
    } else {
      this.panelStyle = null;
    }
  }

  private updatePanelPosition(): void {
    const el = this.trigger?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const width = Math.max(rect.width, 176);
    let left = this.align === 'right' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    this.panelStyle = {
      top: `${rect.bottom + gap}px`,
      left: `${left}px`,
      width: `${width}px`
    };
  }

  select(opt: PremiumSelectOption): void {
    if (opt.disabled) return;
    this.valueChange.emit(opt.value);
    this.open = false;
    this.panelStyle = null;
  }

  trackByValue(_i: number, opt: PremiumSelectOption): string {
    return opt.value;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    if (this.host.nativeElement.contains(ev.target as Node)) return;
    if (this.panel?.nativeElement.contains(ev.target as Node)) return;
    this.open = false;
    this.panelStyle = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
    this.panelStyle = null;
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (!this.open) return;
    this.updatePanelPosition();
  }
}
