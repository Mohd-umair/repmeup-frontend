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

// Feature Components
import { HomeComponent } from './features/home/home.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InboxContainerComponent } from './features/inbox/inbox-container/inbox-container.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { AnalyticsComponent } from './features/analytics/analytics.component';
import { PublishComponent } from './features/publish/publish.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { PublishedPostsComponent } from './features/published-posts/published-posts.component';
import { ContentComponent } from './features/content/content.component';
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

/**
 * App Routing Module - Following SOLID principles
 * Defines all application routes with proper guards
 */
const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  
  // Legal pages (public)
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'terms-conditions', component: TermsConditionsComponent },
  { path: 'terms', redirectTo: 'terms-conditions', pathMatch: 'full' },
  
  // Contact page (public)
  { path: 'contact', component: ContactComponent },

  // About page (public)
  { path: 'about', component: AboutComponent },
  
  // Data deletion status page (public)
  { path: 'data-deletion-status', component: DataDeletionStatusComponent },
  
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
      { path: 'dashboard', component: DashboardComponent },
      { path: 'inbox', component: InboxContainerComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'publish', component: PublishComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/published', component: PublishedPostsComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content', component: ContentComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'brand-hub', component: BrandHubComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content-studio', component: ContentStudioComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'approval-queue', component: ApprovalQueueComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.manage'] } },
      { path: 'trend-explorer', component: TrendExplorerComponent, canActivate: [PermissionGuard], data: { permissions: ['analytics.read'] } },
      { path: 'analytics', component: AnalyticsComponent, canActivate: [PermissionGuard], data: { permissions: ['analytics.read'] } },
      { path: 'knowledge-base', component: KnowledgeBaseComponent, canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'settings', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'agents', component: AgentsComponent, canActivate: [PermissionGuard], data: { permissions: ['users.read'] } },
      { path: 'plans', component: PlansComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      { path: 'ai-credits', component: AiCreditsComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      { path: 'notifications', component: NotificationsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } }
    ]
  },

  // Fallback route
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
