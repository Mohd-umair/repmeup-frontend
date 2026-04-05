import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ApexCharts from 'apexcharts';
import { Subscription, timer } from 'rxjs';
import { take } from 'rxjs/operators';
import { IAgentStats } from '../../../core/models/analytics.model';

@Component({
  selector: 'app-agent-performance-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="block w-full">
      <!-- Empty state when no data -->
      <div *ngIf="!agents?.length"
           class="flex flex-col items-center justify-center py-10 text-center">
        <i class="fas fa-users text-4xl mb-3 text-gray-700"></i>
        <p class="text-sm font-medium text-gray-400 mb-1">No agent performance data</p>
        <p class="text-xs text-gray-600 px-4">
          Assign inbox conversations to team members to track their performance here.
        </p>
      </div>
      <!-- Chart container: always in DOM so ViewChild is set; visible only when we have data -->
      <div #chartEl
           class="agent-performance-chart-host w-full"
           [style.min-height.px]="height"
           [style.display]="agents?.length ? 'block' : 'none'"></div>
    </div>
  `
})
export class AgentPerformanceChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartEl') chartEl!: ElementRef;
  @Input() agents: IAgentStats[] = [];
  @Input() height = 320;

  private chart: ApexCharts | null = null;
  private initialized = false;
  private renderScheduled = false;
  private scheduleSub?: Subscription;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.agents?.length) this.scheduleRender();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized || !changes['agents']) return;
    this.chart?.destroy();
    this.chart = null;
    if (this.agents?.length) this.scheduleRender();
  }

  ngOnDestroy(): void {
    this.scheduleSub?.unsubscribe();
    this.chart?.destroy();
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    this.scheduleSub?.unsubscribe();
    this.scheduleSub = timer(100)
      .pipe(take(1))
      .subscribe(() => {
        this.renderScheduled = false;
        this.scheduleSub = undefined;
        this.renderChart();
      });
  }

  private renderChart(): void {
    if (!this.agents?.length) return;
    const el = this.chartEl?.nativeElement;
    if (!el) return;
    this.chart?.destroy();
    this.chart = null;
    const names = this.agents.map(a => (a.name || 'Unknown').trim() || 'Agent');
    const options = {
      series: [
        { name: 'Assigned', data: this.agents.map(a => a.totalAssigned) },
        { name: 'Resolved', data: this.agents.map(a => a.totalResolved) }
      ],
      chart: {
        type: 'bar',
        height: this.height,
        width: '100%',
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, speed: 600 }
      },
      colors: ['#c8f135', '#10B981'],
      xaxis: {
        categories: names,
        labels: { style: { colors: '#9ca3af' }, rotate: -30 }
      },
      yaxis: { labels: { style: { colors: '#9ca3af' } } },
      plotOptions: { bar: { borderRadius: 5, columnWidth: '60%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: '#1f2937', strokeDashArray: 4 },
      legend: { show: true, labels: { colors: '#d1d5db' }, position: 'top' },
      tooltip: {
        theme: 'dark',
        shared: true,
        intersect: false,
        y: { formatter: (val: number) => val.toLocaleString() }
      }
    };
    try {
      this.chart = new ApexCharts(el, options);
      this.chart.render();
    } catch (err) {
      console.error('Agent performance chart render error:', err);
    }
  }
}
