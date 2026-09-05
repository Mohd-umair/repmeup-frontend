import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ContactService } from '../../../core/services/contact.service';
import { IActivationCampaign } from '../../../core/models/contact.model';

@Component({
  selector: 'app-activation-campaign-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaign-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CampaignListComponent implements OnInit {
  items: IActivationCampaign[] = [];
  loading = false;

  constructor(private contacts: ContactService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.contacts.listCampaigns().subscribe({
      next: (res) => { this.items = res.data || []; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.loading = false; this.cdr.markForCheck(); }
    });
  }

  open(c: IActivationCampaign): void {
    this.router.navigate(['/app/contacts/campaigns', c._id]);
  }
}
