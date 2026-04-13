import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ContactsListComponent } from '../contacts-list/contacts-list.component';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
import { IContact } from '../../../core/models/contact.model';

@Component({
  selector: 'app-contacts-container',
  standalone: true,
  imports: [CommonModule, ContactsListComponent, ContactDetailComponent],
  templateUrl: './contacts-container.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactsContainerComponent implements OnInit {
  selectedContactId: string | null = null;
  showDetail = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) {
      this.selectedContactId = id;
      this.showDetail = true;
    }
  }

  onContactSelected(contact: IContact): void {
    this.selectedContactId = contact._id;
    this.showDetail = true;
    this.cdr.markForCheck();
  }

  onBack(): void {
    this.showDetail = false;
    this.selectedContactId = null;
    this.cdr.markForCheck();
  }

  onDeleted(): void {
    this.showDetail = false;
    this.selectedContactId = null;
    this.cdr.markForCheck();
  }
}
