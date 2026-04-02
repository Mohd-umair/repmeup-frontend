import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PermissionGuard } from './core/guards/permission.guard';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';

// Layout
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';
import { PublicSiteShellComponent } from './shared/components/public-site-shell/public-site-shell.component';

// Feature Components
import { HomeComponent } from './features/home/home.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InboxContainerComponent } from './features/inbox/inbox-container/inbox-container.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { KnowledgeBaseCreateComponent } from './features/knowledge-base/knowledge-base-create/knowledge-base-create.component';
import { AnalyticsComponent } from './features/analytics/analytics.component';
import { AnalyticsLegacyTabRedirectComponent } from './features/analytics/analytics-legacy-tab-redirect.component';
import { PublishComponent } from './features/publish/publish.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { ContentComponent } from './features/content/content.component';
import { PublishPublishedRedirectComponent } from './features/content/publish-published-redirect.component';
import { PlansComponent } from './features/plans/plans.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { ContactComponent } from './features/contact/contact.component';
import { AboutComponent } from './features/about/about.component';
import { DataDeletionStatusComponent } from './features/data-deletion-status/data-deletion-status.component';
import { AiCreditsComponent } from './features/ai-credits/ai-credits.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { BrandHubComponent } from './features/brand-hub/brand-hub.component';
import { ApprovalQueueComponent } from './features/approval-queue/approval-queue.component';
import { TrendExplorerComponent } from './features/trend-explorer/trend-explorer.component';
import { ContentStudioComponent } from './features/content-studio/content-studio.component';
import { ScheduledPostsComponent } from './features/scheduled-posts/scheduled-posts.component';
import { DraftsComponent } from './features/drafts/drafts.component';

/**
 * App Routing Module - Following SOLID principles
 * Defines all application routes with proper guards
 */
const routes: Routes = [
  // Public marketing site (shared header + footer)
  {
    path: '',
    component: PublicSiteShellComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'home', redirectTo: '', pathMatch: 'full' },
      { path: 'privacy-policy', component: PrivacyPolicyComponent },
      { path: 'terms-conditions', component: TermsConditionsComponent },
      { path: 'contact', component: ContactComponent },
      { path: 'about', component: AboutComponent },
      { path: 'data-deletion-status', component: DataDeletionStatusComponent },
    ],
  },
  { path: 'terms', redirectTo: 'terms-conditions', pathMatch: 'full' },
  
  // Auth routes (public)
  {
    path: 'auth',
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'google-callback', component: GoogleCallbackComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent }
    ]
  },

  // Protected routes
  {
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, canActivate: [PermissionGuard], data: { permissions: ['analytics.read'] } },
      { path: 'inbox', component: InboxContainerComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'publish', component: PublishComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/published', component: PublishPublishedRedirectComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/approval-queue', redirectTo: 'approval-queue', pathMatch: 'full' },
      { path: 'calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content', component: ContentComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'brand-hub', component: BrandHubComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content-studio', component: ContentStudioComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'scheduled-posts', component: ScheduledPostsComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'drafts', component: DraftsComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'approval-queue', component: ApprovalQueueComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.manage', 'posts.read'] } },
      { path: 'trend-explorer', component: TrendExplorerComponent, canActivate: [PermissionGuard], data: { permissions: ['analytics.export'] } },
      {
        path: 'analytics/:legacyTab',
        component: AnalyticsLegacyTabRedirectComponent,
        canActivate: [PermissionGuard],
        data: { permissions: ['analytics.read'] }
      },
      {
        path: 'analytics',
        component: AnalyticsComponent,
        canActivate: [PermissionGuard],
        data: { permissions: ['analytics.read'] }
      },
      { path: 'knowledge-base', component: KnowledgeBaseComponent, canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'knowledge-base/create', component: KnowledgeBaseCreateComponent, canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'settings', redirectTo: 'settings/platforms', pathMatch: 'full' },
      { path: 'settings/platforms', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/profile', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/organization', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['organization.read'] } },
      { path: 'settings/notifications', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/auto-reply', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/brand-rules', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/compliance', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/intent-buckets', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'agents', component: AgentsComponent, canActivate: [PermissionGuard], data: { permissions: ['users.read'] } },
      { path: 'plans', component: PlansComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.manage'] } },
      { path: 'ai-credits', component: AiCreditsComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      { path: 'notifications', component: NotificationsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } }
    ]
  },

  // Fallback route
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
