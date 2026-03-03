import { Component } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { LoaderService } from '../../../core/services/loader.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <div *ngIf="loaderService.loading$ | async" class="global-loader-bar">
      <div class="global-loader-progress"></div>
    </div>
  `,
  styles: [`
    .global-loader-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      z-index: 99999;
      background: rgba(208, 255, 0, 0.15);
      overflow: hidden;
    }

    .global-loader-progress {
      height: 100%;
      background: linear-gradient(90deg, #D0FF00 0%, #B8E600 40%, #ffffff 60%, #D0FF00 100%);
      background-size: 200% 100%;
      animation: loader-slide 1.4s ease-in-out infinite;
      border-radius: 0 2px 2px 0;
    }

    @keyframes loader-slide {
      0%   { transform: translateX(-100%); }
      50%  { transform: translateX(0%); }
      100% { transform: translateX(100%); }
    }
  `]
})
export class GlobalLoaderComponent {
  constructor(public loaderService: LoaderService) {}
}
