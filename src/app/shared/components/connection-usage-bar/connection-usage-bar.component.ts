import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Connection Usage Bar Component (Single Responsibility)
 * Displays account usage and plan limits with visual progress bar
 */
@Component({
  selector: 'app-connection-usage-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-usage-bar.component.html',
  styleUrls: ['./connection-usage-bar.component.scss']
})
export class ConnectionUsageBarComponent {
  @Input() current: number = 0;
  @Input() max: number = 0;
  @Input() showUpgrade: boolean = true;

  get remaining(): number {
    return Math.max(0, this.max - this.current);
  }

  get percentage(): number {
    if (this.max === 0) return 0;
    return Math.min(100, (this.current / this.max) * 100);
  }

  get isAtLimit(): boolean {
    return this.current >= this.max;
  }

  get isNearLimit(): boolean {
    return this.percentage >= 80 && !this.isAtLimit;
  }

  get progressColor(): string {
    if (this.isAtLimit) return 'bg-amber-500';
    if (this.isNearLimit) return 'bg-yellow-500';
    return 'bg-rep-lime';
  }

  get statusText(): string {
    if (this.isAtLimit) {
      return 'Plan limit reached';
    }
    if (this.isNearLimit) {
      return `${this.remaining} slot${this.remaining !== 1 ? 's' : ''} remaining`;
    }
    return `${this.remaining} of ${this.max} available`;
  }
}
