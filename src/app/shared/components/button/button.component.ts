import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss']
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() fullWidth = false;
  @Input() iconLeft?: string;
  @Input() iconRight?: string;

  @Output() buttonClick = new EventEmitter<void>();

  get buttonClasses(): string {
    const parts = [
      'size-' + this.size,
      'variant-' + this.variant
    ];
    if (this.fullWidth) parts.push('full-width');
    return parts.join(' ');
  }

  onClick(): void {
    if (this.disabled || this.loading) return;
    this.buttonClick.emit();
  }
}
