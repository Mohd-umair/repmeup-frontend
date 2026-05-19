import { Component, Input, forwardRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Consistent iOS-style switch for automation pages (light + dark).
 */
@Component({
  selector: 'app-automation-switch',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="auto-switch" [class.auto-switch--disabled]="isDisabled">
      <input
        type="checkbox"
        class="auto-switch__input"
        [checked]="value"
        (change)="onInputChange($event)"
        [disabled]="isDisabled"
        [attr.name]="name || null"
        [attr.aria-label]="ariaLabel || null"
      />
      <span class="auto-switch__track" aria-hidden="true"></span>
    </label>
  `,
  styleUrls: ['./automation-switch.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutomationSwitchComponent),
      multi: true,
    },
  ],
})
export class AutomationSwitchComponent implements ControlValueAccessor {
  /** Extra disable from parent (e.g. loading); combines with CVA disabled. */
  @Input() disabled = false;
  @Input() name = '';
  @Input() ariaLabel = '';

  value = false;

  private cvaDisabled = false;
  private onChange: (v: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  get isDisabled(): boolean {
    return this.disabled || this.cvaDisabled;
  }

  writeValue(v: unknown): void {
    this.value = !!v;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.cvaDisabled = disabled;
    this.cdr.markForCheck();
  }

  onInputChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.value = checked;
    this.onChange(checked);
    this.onTouched();
    this.cdr.markForCheck();
  }
}
