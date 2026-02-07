import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NotificationComponent } from './components/notification/notification.component';
import { ConnectionUsageBarComponent } from './components/connection-usage-bar/connection-usage-bar.component';
import { ConnectedAccountsListComponent } from './components/connected-accounts-list/connected-accounts-list.component';
import { MetaPageSelectorComponent } from './components/meta-page-selector/meta-page-selector.component';

@NgModule({
  declarations: [
    NotificationComponent,
    ConnectionUsageBarComponent,
    ConnectedAccountsListComponent,
    MetaPageSelectorComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    NotificationComponent,
    ConnectionUsageBarComponent,
    ConnectedAccountsListComponent,
    MetaPageSelectorComponent
  ]
})
export class SharedModule { }

