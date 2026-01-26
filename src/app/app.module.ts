import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

// Feature Components
import { DashboardComponent } from './features/dashboard/dashboard.component';

// Shared Components
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';

// Interceptors
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { InboxContainerComponent } from './features/inbox/inbox-container/inbox-container.component';
import { InboxFiltersComponent } from './features/inbox/inbox-filters/inbox-filters.component';
import { InboxTopFiltersComponent } from './features/inbox/inbox-top-filters/inbox-top-filters.component';
import { InboxListComponent } from './features/inbox/inbox-list/inbox-list.component';
import { InboxDetailComponent } from './features/inbox/inbox-detail/inbox-detail.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { AnalyticsComponent } from './features/analytics/analytics.component';
import { HomeComponent } from './features/home/home.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { ContactComponent } from './features/contact/contact.component';
import { DataDeletionStatusComponent } from './features/data-deletion-status/data-deletion-status.component';

/**
 * App Module - Following SOLID principles
 * Main application module with all necessary imports and providers
 */
@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    DashboardComponent,
    SidebarComponent,
    HeaderComponent,
    MainLayoutComponent,
    InboxContainerComponent,
    InboxFiltersComponent,
    InboxTopFiltersComponent,
    InboxListComponent,
    InboxDetailComponent,
    SettingsComponent,
    AgentsComponent,
    KnowledgeBaseComponent,
    AnalyticsComponent,
    HomeComponent,
    PrivacyPolicyComponent,
    TermsConditionsComponent,
    ContactComponent,
    DataDeletionStatusComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
