import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifecycleStage, LifecycleStageData } from '../lifecycle-stage.models';

@Component({
  selector: 'app-lifecycle-stage-visual',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lifecycle-stage-visual.component.html',
  styleUrls: ['./lifecycle-stage-visual.component.scss'],
})
export class LifecycleStageVisualComponent {
  @Input({ required: true }) stage!: LifecycleStage;
  @Input({ required: true }) data!: LifecycleStageData;
}
