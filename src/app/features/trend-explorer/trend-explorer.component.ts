import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { TrendCardComponent, TrendCardItem } from '../../shared/components/trend-card/trend-card.component';

@Component({
  selector: 'app-trend-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, TrendCardComponent],
  templateUrl: './trend-explorer.component.html',
  styleUrls: ['./trend-explorer.component.scss']
})
export class TrendExplorerComponent implements OnInit {
  trending: TrendCardItem[] = [];
  memes: any[] = [];
  holidays: any[] = [];
  searchQuery = '';
  loadingTrending = true;
  loadingMemes = true;
  loadingHolidays = true;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTrending();
    this.loadMemes();
    this.loadHolidays();
  }

  loadTrending(): void {
    this.loadingTrending = true;
    this.http.get<{ success: boolean; data: TrendCardItem[] }>(`${environment.apiUrl}/trends`).subscribe({
      next: (res) => {
        this.trending = (res.success && res.data) ? res.data : [];
        this.loadingTrending = false;
      },
      error: () => {
        this.trending = [];
        this.loadingTrending = false;
      }
    });
  }

  loadMemes(): void {
    this.loadingMemes = true;
    this.http.get<{ success: boolean; data: any[] }>(`${environment.apiUrl}/trends/memes`).subscribe({
      next: (res) => {
        this.memes = (res.success && res.data) ? res.data : [];
        this.loadingMemes = false;
      },
      error: () => {
        this.memes = [];
        this.loadingMemes = false;
      }
    });
  }

  loadHolidays(): void {
    this.loadingHolidays = true;
    this.http.get<{ success: boolean; data: any[] }>(`${environment.apiUrl}/trends/holidays`).subscribe({
      next: (res) => {
        this.holidays = (res.success && res.data) ? res.data : [];
        this.loadingHolidays = false;
      },
      error: () => {
        this.holidays = [];
        this.loadingHolidays = false;
      }
    });
  }

  search(): void {
    if (!this.searchQuery.trim()) {
      this.loadTrending();
      return;
    }
    this.loadingTrending = true;
    this.http.get<{ success: boolean; data: TrendCardItem[] }>(`${environment.apiUrl}/trends`, { params: { q: this.searchQuery } }).subscribe({
      next: (res) => {
        this.trending = (res.success && res.data) ? res.data : [];
        this.loadingTrending = false;
      },
      error: () => {
        this.trending = [];
        this.loadingTrending = false;
      }
    });
  }

  onGenerate(trend: TrendCardItem): void {
    this.router.navigate(['/app/content-studio'], {
      queryParams: { topic: trend.title, trend: trend.id }
    });
  }

  onGenerateMeme(m: any): void {
    this.router.navigate(['/app/content-studio'], {
      queryParams: { topic: m.title || m.template, trend: m.id }
    });
  }

  onGenerateHoliday(h: any): void {
    this.router.navigate(['/app/content-studio'], {
      queryParams: { topic: h.name, trend: 'holiday', date: h.date }
    });
  }
}
