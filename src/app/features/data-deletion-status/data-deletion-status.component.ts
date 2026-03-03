import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Data Deletion Status Component
 * Displays status of Facebook/Instagram data deletion request
 */
@Component({
  selector: 'app-data-deletion-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-deletion-status.component.html',
  styleUrls: ['./data-deletion-status.component.scss']
})
export class DataDeletionStatusComponent implements OnInit {
  loading = true;
  status: 'completed' | 'processing' | 'not_found' | 'error' = 'processing';
  message = '';
  confirmationCode = '';
  requestedAt: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      if (code) {
        this.confirmationCode = code;
        this.checkStatus(code);
      } else {
        this.loading = false;
        this.status = 'not_found';
        this.message = 'No confirmation code provided.';
      }
    });
  }

  checkStatus(code: string): void {
    this.http.get<any>(`${environment.apiUrl}/data-delete/status?code=${code}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.status = response.status;
            this.message = response.message;
            this.requestedAt = response.requestedAt ? new Date(response.requestedAt) : null;
          } else {
            this.status = 'error';
            this.message = response.message || 'Failed to check deletion status.';
          }
        },
        error: (error) => {
          console.error('Error checking deletion status:', error);
          this.loading = false;
          this.status = 'not_found';
          this.message = error.error?.message || 'Deletion request not found or has expired.';
        }
      });
  }
}

