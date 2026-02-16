import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationComponent } from './components/notification/notification.component';
import { ConnectionUsageBarComponent } from './components/connection-usage-bar/connection-usage-bar.component';
import { ConnectedAccountsListComponent } from './components/connected-accounts-list/connected-accounts-list.component';
import { MetaPageSelectorComponent } from './components/meta-page-selector/meta-page-selector.component';
import { MediaUploadGuideComponent } from './components/media-upload-guide/media-upload-guide.component';
import { MediaUploadModalComponent } from './components/media-upload-modal/media-upload-modal.component';
import { MediaSelectorModalComponent } from './components/media-selector-modal/media-selector-modal.component';

@NgModule({
  declarations: [
    NotificationComponent,
    ConnectionUsageBarComponent,
    ConnectedAccountsListComponent,
    MetaPageSelectorComponent,
    MediaUploadGuideComponent,
    MediaUploadModalComponent,
    MediaSelectorModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  exports: [
    NotificationComponent,
    ConnectionUsageBarComponent,
    ConnectedAccountsListComponent,
    MetaPageSelectorComponent,
    MediaUploadGuideComponent,
    MediaUploadModalComponent,
    MediaSelectorModalComponent
  ]
})
export class SharedModule { }

