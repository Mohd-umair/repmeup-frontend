import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

export interface TrendCardItem {
  id: string;
  title: string;
  source?: string;
  relevanceScore?: number;
  suggestedAngle?: string;
}

@Component({
  selector: 'app-trend-card',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './trend-card.component.html',
  styleUrls: ['./trend-card.component.scss']
})
export class TrendCardComponent {
  @Input() trend!: TrendCardItem;
  @Output() generate = new EventEmitter<TrendCardItem>();
}
