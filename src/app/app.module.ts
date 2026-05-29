import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PaginationComponent } from './shared/components/pagination/pagination.component';
import { PublicSiteShellComponent } from './shared/components/public-site-shell/public-site-shell.component';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SharedModule } from './shared/shared.module';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';

// Feature Components
import { DashboardComponent } from './features/dashboard/dashboard.component';

// Shared Components
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';

// Interceptors
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { LoaderInterceptor } from './core/interceptors/loader.interceptor';
import { InboxContainerComponent } from './features/inbox/inbox-container/inbox-container.component';
import { InboxFiltersComponent } from './features/inbox/inbox-filters/inbox-filters.component';
import { InboxTopFiltersComponent } from './features/inbox/inbox-top-filters/inbox-top-filters.component';
import { InboxListComponent } from './features/inbox/inbox-list/inbox-list.component';
import { InboxDetailComponent } from './features/inbox/inbox-detail/inbox-detail.component';
import { InboxActionsComponent } from './features/inbox/inbox-actions/inbox-actions.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { AnalyticsComponent } from './features/analytics/analytics.component';
import { HomeComponent } from './features/home/home.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { RefundCancellationPolicyComponent } from './features/legal/refund-cancellation-policy/refund-cancellation-policy.component';
import { ContactComponent } from './features/contact/contact.component';
import { AboutComponent } from './features/about/about.component';
import { FaqComponent } from './features/faq/faq.component';
import { DataDeletionStatusComponent } from './features/data-deletion-status/data-deletion-status.component';
import { PublishComponent } from './features/publish/publish.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { PublishPublishedRedirectComponent } from './features/content/publish-published-redirect.component';
import { AnalyticsLegacyTabRedirectComponent } from './features/analytics/analytics-legacy-tab-redirect.component';
import { PlansComponent } from './features/plans/plans.component';
import { PageManagerComponent } from './features/settings/components/page-manager/page-manager.component';
import { SocialPreviewComponent } from './features/publish/social-preview/social-preview.component';
import { AiCreditsComponent } from './features/ai-credits/ai-credits.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { MediaLibraryComponent } from './features/media-library/media-library.component';
import { UpgradePromptComponent } from './shared/components/upgrade-prompt/upgrade-prompt.component';

/**
 * App Module - Following SOLID principles
 * Main application module with all necessary imports and providers
 */
@NgModule({
  declarations: [
    AppComponent,
    GoogleCallbackComponent,
    AgentsComponent,
    PrivacyPolicyComponent,
    TermsConditionsComponent,
    RefundCancellationPolicyComponent,
    AboutComponent,
    FaqComponent,
    AiCreditsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    SharedModule,
    LoginComponent,
    RegisterComponent,
    DashboardComponent,
    AnalyticsComponent,
    AnalyticsLegacyTabRedirectComponent,
    HomeComponent,
    ContactComponent,
    DataDeletionStatusComponent,
    CalendarComponent,
    PlansComponent,
    SidebarComponent,
    HeaderComponent,
    MainLayoutComponent,
    SettingsComponent,
    PublishComponent,
    PublishPublishedRedirectComponent,
    PageManagerComponent,
    InboxContainerComponent,
    KnowledgeBaseComponent,
    NotificationsComponent,
    MediaLibraryComponent,
    SocialPreviewComponent,
    PaginationComponent,
    PublicSiteShellComponent,
    UpgradePromptComponent
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
