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

export interface InboxMultiselectOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  disabledHint?: string;
}

@Component({
  selector: 'app-inbox-multiselect-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inbox-multiselect-filter.component.html',
  styleUrls: ['./inbox-multiselect-filter.component.scss']
})
export class InboxMultiselectFilterComponent {
  @Input() label = '';
  @Input() options: InboxMultiselectOption[] = [];
  @Input() selected: string[] = [];
  @Input() placeholder = 'Any';
  @Output() selectedChange = new EventEmitter<string[]>();

  open = false;

  constructor(private host: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open) return;
    const t = ev.target as Node;
    if (this.host.nativeElement.contains(t)) return;
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
