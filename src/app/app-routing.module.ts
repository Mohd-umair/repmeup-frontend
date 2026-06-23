import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PermissionGuard } from './core/guards/permission.guard';
import { PlanFeatureGuard } from './core/guards/plan-feature.guard';
import { FEATURE_KEY } from './core/services/entitlements.store';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';
import { ImpersonateCallbackComponent } from './features/auth/impersonate-callback/impersonate-callback.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { VerifyEmailComponent } from './features/auth/verify-email/verify-email.component';
import { CheckEmailComponent } from './features/auth/check-email/check-email.component';

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
import { BookDemoComponent } from './features/book-demo/book-demo.component';
import { AboutComponent } from './features/about/about.component';
import { FaqComponent } from './features/faq/faq.component';
import { DataDeletionStatusComponent } from './features/data-deletion-status/data-deletion-status.component';
import { RefundCancellationPolicyComponent } from './features/legal/refund-cancellation-policy/refund-cancellation-policy.component';
import { WhatsappOAuthResultComponent } from './features/oauth/whatsapp-oauth-result.component';
import { WhatsAppTemplatesComponent } from './features/whatsapp-templates/whatsapp-templates.component';
import { AiCreditsComponent } from './features/ai-credits/ai-credits.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { BrandHubComponent } from './features/brand-hub/brand-hub.component';
import { ApprovalQueueComponent } from './features/approval-queue/approval-queue.component';
import { TrendExplorerComponent } from './features/trend-explorer/trend-explorer.component';
import { ContentStudioComponent } from './features/content-studio/content-studio.component';
import { ScheduledPostsComponent } from './features/scheduled-posts/scheduled-posts.component';
import { DraftsComponent } from './features/drafts/drafts.component';
import { BucketSettingsComponent } from './features/settings/components/bucket-settings/bucket-settings.component';
import { SupportComponent } from './features/support/support.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { ContactsContainerComponent } from './features/contacts/contacts-container/contacts-container.component';
import { PlatformTroubleshootingComponent } from './features/settings/platform-troubleshooting/platform-troubleshooting.component';
import { VoiceIvrComponent } from './features/voice-ivr/voice-ivr.component';
import { VoiceDashboardComponent } from './features/voice-ivr/voice-dashboard/voice-dashboard.component';
import { VoiceAgentsComponent } from './features/voice-ivr/voice-agents/voice-agents.component';
import { VoiceCallsComponent } from './features/voice-ivr/voice-calls/voice-calls.component';
import { VoiceSettingsComponent } from './features/voice-ivr/voice-settings/voice-settings.component';
import { AutomationHubComponent } from './features/automation/hub/automation-hub.component';
import { AiRepliesComponent } from './features/automation/ai-replies/ai-replies.component';
import { GrowthComponent } from './features/automation/growth/growth.component';
import { ReviewCollectionComponent } from './features/automation/reviews/review-collection.component';
import { RetargetingComponent } from './features/automation/retargeting/retargeting.component';
import { EscalationComponent } from './features/automation/escalation/escalation.component';
import { CampaignsComponent } from './features/campaigns/campaigns.component';
import { ReportsComponent } from './features/reports/reports.component';
import { InboxOrderManagementComponent } from './features/inbox-ops/order-management/inbox-order-management.component';
import { InboxComplaintManagementComponent } from './features/inbox-ops/complaint-management/inbox-complaint-management.component';
import { InboxReviewManagementComponent } from './features/inbox-ops/review-management/inbox-review-management.component';

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
      { path: 'book-demo', component: BookDemoComponent },
      { path: 'demo', redirectTo: 'book-demo', pathMatch: 'full' },
      { path: 'about', component: AboutComponent },
      { path: 'faq', component: FaqComponent },
      { path: 'data-deletion-status', component: DataDeletionStatusComponent },
      { path: 'refund-cancellation-policy', component: RefundCancellationPolicyComponent },
      { path: 'whatsapp-oauth-callback', component: WhatsappOAuthResultComponent },
    ],
  },
  { path: 'terms', redirectTo: 'terms-conditions', pathMatch: 'full' },

  // Demo prospect magic-link landing (public). Standalone component, lazy-loaded.
  {
    path: 'demo-login',
    loadComponent: () =>
      import('./features/auth/demo-login/demo-login.component').then(m => m.DemoLoginComponent)
  },

  // Auth routes (public)
  {
    path: 'auth',
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'google-callback', component: GoogleCallbackComponent },
      { path: 'impersonate-callback', component: ImpersonateCallbackComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: 'verify-email', component: VerifyEmailComponent },
      { path: 'check-email', component: CheckEmailComponent }
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
      {
        path: 'inbox/buckets',
        component: InboxContainerComponent,
        canActivate: [PermissionGuard],
        data: { permissions: ['inbox.read'], inboxLayout: 'buckets' }
      },
      { path: 'inbox', component: InboxContainerComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'], inboxLayout: 'list' } },
      { path: 'inbox/order-management', component: InboxOrderManagementComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'inbox/compliant-management', component: InboxComplaintManagementComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'inbox/review-managment', component: InboxReviewManagementComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'appointments', loadComponent: () => import('./features/appointments/appointment-management.component').then((m) => m.AppointmentManagementComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'appointments/setup', loadComponent: () => import('./features/appointments/appointment-setup.component').then((m) => m.AppointmentSetupComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'publish', component: PublishComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/published', component: PublishPublishedRedirectComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/approval-queue', redirectTo: 'approval-queue', pathMatch: 'full' },
      { path: 'calendar', component: CalendarComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/content', component: ContentComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'brand-hub', component: BrandHubComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content-studio', component: ContentStudioComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/scheduled-posts', component: ScheduledPostsComponent, canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
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
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['analytics.read'], planFeature: FEATURE_KEY.ANALYTICS_ADVANCED }
      },
      { path: 'knowledge-base', component: KnowledgeBaseComponent, canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'knowledge-base/create', component: KnowledgeBaseCreateComponent, canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'settings', redirectTo: 'settings/platforms', pathMatch: 'full' },
      { path: 'settings/platforms', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/platform-troubleshooting', component: PlatformTroubleshootingComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/profile', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/organization', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['organization.read'] } },
      { path: 'settings/notifications', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/auto-reply', redirectTo: '/app/automation/ai-replies', pathMatch: 'full' },
      { path: 'settings/brand-rules', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/compliance', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/accounts', component: SettingsComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      {
        path: 'intent-buckets',
        component: BucketSettingsComponent,
        canActivate: [PermissionGuard],
        data: { permissions: ['inbox.read', 'settings.read'] }
      },
      { path: 'agents', component: AgentsComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['users.read'], planFeature: FEATURE_KEY.AGENTS_ENABLED } },
      { path: 'plans', component: PlansComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.manage'] } },
      { path: 'ai-credits', component: AiCreditsComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      { path: 'notifications', component: NotificationsComponent, canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'support', component: SupportComponent },
      { path: 'catalog', component: CatalogComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.COMMERCE_WA_CATALOG_ENABLED } },
      { path: 'contacts', component: ContactsContainerComponent, canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'whatsapp-templates', component: WhatsAppTemplatesComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.WHATSAPP_TEMPLATES_MAX } },
      { path: 'campaigns', component: CampaignsComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.CAMPAIGNS_ENABLED } },
      { path: 'reports', component: ReportsComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['analytics.read'], planFeature: FEATURE_KEY.ANALYTICS_ADVANCED } },
      {
        path: 'voice-ivr',
        component: VoiceIvrComponent,
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.VOICE_IVR_ENABLED },
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', component: VoiceDashboardComponent },
          { path: 'agents',    component: VoiceAgentsComponent },
          { path: 'calls',     component: VoiceCallsComponent },
          { path: 'settings',  component: VoiceSettingsComponent }
        ]
      },
      {
        path: 'automation',
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.AUTO_REPLY_ENABLED },
        children: [
          { path: '', component: AutomationHubComponent },
          { path: 'ai-replies', component: AiRepliesComponent },
          { path: 'growth', component: GrowthComponent },
          {
            path: 'flows',
            loadComponent: () =>
              import('./features/automation/flow-builder/flow-list/flow-list.component').then((m) => m.FlowListComponent)
          },
          {
            path: 'flows/:id/edit',
            loadComponent: () =>
              import('./features/automation/flow-builder/flow-builder/flow-builder.component').then((m) => m.FlowBuilderComponent)
          },
          { path: 'whatsapp-flows', redirectTo: 'flows', pathMatch: 'full' },
          { path: 'reviews', component: ReviewCollectionComponent },
          { path: 'retargeting', component: RetargetingComponent },
          { path: 'escalation', component: EscalationComponent }
        ]
      }
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
