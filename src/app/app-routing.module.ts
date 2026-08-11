import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PermissionGuard } from './core/guards/permission.guard';
import { PlanFeatureGuard } from './core/guards/plan-feature.guard';
import { FEATURE_KEY } from './core/services/entitlements.store';

// Layout shells — used immediately as route containers, so kept eager.
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';
import { PublicSiteShellComponent } from './shared/components/public-site-shell/public-site-shell.component';

// Non-standalone components declared in AppModule. These CANNOT be lazy-loaded via
// loadComponent until converted to standalone, so they remain eager for now.
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';
import { ImpersonateCallbackComponent } from './features/auth/impersonate-callback/impersonate-callback.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { RefundCancellationPolicyComponent } from './features/legal/refund-cancellation-policy/refund-cancellation-policy.component';
import { AboutComponent } from './features/about/about.component';
import { FaqComponent } from './features/faq/faq.component';
import { AgentsComponent } from './features/agents/agents.component';
import { AiCreditsComponent } from './features/ai-credits/ai-credits.component';

/**
 * App Routing Module - Following SOLID principles
 * Defines all application routes with proper guards.
 *
 * Standalone feature components are lazy-loaded with `loadComponent` so they are
 * split into their own chunks and kept out of the initial bundle. Only the layout
 * shells and the handful of still-non-standalone components above load eagerly.
 */
const routes: Routes = [
  // ── Growth Intelligence public audit (no AuthGuard) ─────────────────────────
  // Loaded outside PublicSiteShell so the report page has full viewport control.
  {
    path: 'growth-audit',
    component: PublicSiteShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/growth-audit/audit-landing.component').then(m => m.AuditLandingComponent)
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/growth-audit/audit-page.component').then(m => m.AuditPageComponent)
      },
      {
        path: 'r/:id/:token',
        loadComponent: () =>
          import('./features/growth-audit/audit-share.component').then(m => m.AuditShareComponent)
      }
    ]
  },

  // Public marketing site (shared header + footer)
  {
    path: '',
    component: PublicSiteShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },
      { path: 'home', redirectTo: '', pathMatch: 'full' },
      { path: 'privacy-policy', component: PrivacyPolicyComponent },
      { path: 'terms-conditions', component: TermsConditionsComponent },
      { path: 'pricing', loadComponent: () => import('./features/pricing/pricing.component').then(m => m.PricingComponent) },
      { path: 'contact', loadComponent: () => import('./features/contact/contact.component').then(m => m.ContactComponent) },
      { path: 'book-demo', loadComponent: () => import('./features/book-demo/book-demo.component').then(m => m.BookDemoComponent) },
      { path: 'demo', redirectTo: 'book-demo', pathMatch: 'full' },
      { path: 'about', component: AboutComponent },
      { path: 'faq', component: FaqComponent },
      { path: 'data-deletion-status', loadComponent: () => import('./features/data-deletion-status/data-deletion-status.component').then(m => m.DataDeletionStatusComponent) },
      { path: 'refund-cancellation-policy', component: RefundCancellationPolicyComponent },
      { path: 'whatsapp-oauth-callback', loadComponent: () => import('./features/oauth/whatsapp-oauth-result.component').then(m => m.WhatsappOAuthResultComponent) },
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
      { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
      { path: 'google-callback', component: GoogleCallbackComponent },
      { path: 'impersonate-callback', component: ImpersonateCallbackComponent },
      { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
      { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
      { path: 'verify-email', loadComponent: () => import('./features/auth/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
      { path: 'check-email', loadComponent: () => import('./features/auth/check-email/check-email.component').then(m => m.CheckEmailComponent) }
    ]
  },

  // Protected routes
  {
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [PermissionGuard], data: { permissions: ['analytics.read'] } },
      {
        path: 'inbox/buckets',
        loadComponent: () => import('./features/inbox/inbox-container/inbox-container.component').then(m => m.InboxContainerComponent),
        canActivate: [PermissionGuard],
        data: { permissions: ['inbox.read'], inboxLayout: 'buckets' }
      },
      { path: 'inbox', loadComponent: () => import('./features/inbox/inbox-container/inbox-container.component').then(m => m.InboxContainerComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'], inboxLayout: 'list' } },
      { path: 'inbox/order-management', loadComponent: () => import('./features/inbox-ops/order-management/inbox-order-management.component').then(m => m.InboxOrderManagementComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'inbox/compliant-management', loadComponent: () => import('./features/inbox-ops/complaint-management/inbox-complaint-management.component').then(m => m.InboxComplaintManagementComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'inbox/review-managment', loadComponent: () => import('./features/inbox-ops/review-management/inbox-review-management.component').then(m => m.InboxReviewManagementComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'appointments', loadComponent: () => import('./features/appointments/appointment-management.component').then((m) => m.AppointmentManagementComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'appointments/setup', loadComponent: () => import('./features/appointments/appointment-setup.component').then((m) => m.AppointmentSetupComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'publish', loadComponent: () => import('./features/publish/publish.component').then(m => m.PublishComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/calendar', loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/published', loadComponent: () => import('./features/content/publish-published-redirect.component').then(m => m.PublishPublishedRedirectComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/approval-queue', redirectTo: 'approval-queue', pathMatch: 'full' },
      { path: 'calendar', loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'publish/content', loadComponent: () => import('./features/content/content.component').then(m => m.ContentComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'brand-hub', loadComponent: () => import('./features/brand-hub/brand-hub.component').then(m => m.BrandHubComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'content-studio', loadComponent: () => import('./features/content-studio/content-studio.component').then(m => m.ContentStudioComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.create'] } },
      { path: 'publish/scheduled-posts', loadComponent: () => import('./features/scheduled-posts/scheduled-posts.component').then(m => m.ScheduledPostsComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'drafts', loadComponent: () => import('./features/drafts/drafts.component').then(m => m.DraftsComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.read'] } },
      { path: 'approval-queue', loadComponent: () => import('./features/approval-queue/approval-queue.component').then(m => m.ApprovalQueueComponent), canActivate: [PermissionGuard], data: { permissions: ['posts.manage', 'posts.read'] } },
      { path: 'trend-explorer', loadComponent: () => import('./features/trend-explorer/trend-explorer.component').then(m => m.TrendExplorerComponent), canActivate: [PermissionGuard], data: { permissions: ['analytics.export'] } },
      {
        path: 'analytics/:legacyTab',
        loadComponent: () => import('./features/analytics/analytics-legacy-tab-redirect.component').then(m => m.AnalyticsLegacyTabRedirectComponent),
        canActivate: [PermissionGuard],
        data: { permissions: ['analytics.read'] }
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['analytics.read'], planFeature: FEATURE_KEY.ANALYTICS_ADVANCED }
      },
      { path: 'knowledge-base', loadComponent: () => import('./features/knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent), canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'knowledge-base/create', loadComponent: () => import('./features/knowledge-base/knowledge-base-create/knowledge-base-create.component').then(m => m.KnowledgeBaseCreateComponent), canActivate: [PermissionGuard], data: { permissions: ['knowledge_base.read'] } },
      { path: 'settings', redirectTo: 'settings/platforms', pathMatch: 'full' },
      { path: 'settings/platforms', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/platform-troubleshooting', loadComponent: () => import('./features/settings/platform-troubleshooting/platform-troubleshooting.component').then(m => m.PlatformTroubleshootingComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/profile', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/organization', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['organization.read'] } },
      { path: 'settings/notifications', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/auto-reply', redirectTo: '/app/automation/ai-replies', pathMatch: 'full' },
      { path: 'settings/brand-rules', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/compliance', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'settings/accounts', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent), canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      {
        path: 'intent-buckets',
        loadComponent: () => import('./features/settings/components/bucket-settings/bucket-settings.component').then(m => m.BucketSettingsComponent),
        canActivate: [PermissionGuard],
        data: { permissions: ['inbox.read', 'settings.read'] }
      },
      { path: 'agents', component: AgentsComponent, canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['users.read'], planFeature: FEATURE_KEY.AGENTS_ENABLED } },
      { path: 'plans', loadComponent: () => import('./features/plans/plans.component').then(m => m.PlansComponent), canActivate: [PermissionGuard], data: { permissions: ['billing.manage'] } },
      { path: 'ai-credits', component: AiCreditsComponent, canActivate: [PermissionGuard], data: { permissions: ['billing.read'] } },
      { path: 'notifications', loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent), canActivate: [PermissionGuard], data: { permissions: ['settings.read'] } },
      { path: 'support', loadComponent: () => import('./features/support/support.component').then(m => m.SupportComponent) },
      { path: 'catalog', loadComponent: () => import('./features/catalog/catalog.component').then(m => m.CatalogComponent), canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.COMMERCE_WA_CATALOG_ENABLED } },
      { path: 'contacts', loadComponent: () => import('./features/contacts/contacts-container/contacts-container.component').then(m => m.ContactsContainerComponent), canActivate: [PermissionGuard], data: { permissions: ['inbox.read'] } },
      { path: 'whatsapp-templates', loadComponent: () => import('./features/whatsapp-templates/whatsapp-templates.component').then(m => m.WhatsAppTemplatesComponent), canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.WHATSAPP_TEMPLATES_MAX } },
      { path: 'campaigns', loadComponent: () => import('./features/campaigns/campaigns.component').then(m => m.CampaignsComponent), canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.CAMPAIGNS_ENABLED } },
      { path: 'reports', loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent), canActivate: [PermissionGuard, PlanFeatureGuard], data: { permissions: ['analytics.read'], planFeature: FEATURE_KEY.ANALYTICS_ADVANCED } },
      {
        path: 'growth-intelligence',
        loadComponent: () =>
          import('./features/growth-intelligence/growth-intelligence.component').then(m => m.GrowthIntelligenceComponent)
      },
      {
        path: 'voice-ivr',
        loadComponent: () => import('./features/voice-ivr/voice-ivr.component').then(m => m.VoiceIvrComponent),
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.VOICE_IVR_ENABLED },
        children: [
          { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
          { path: 'dashboard', loadComponent: () => import('./features/voice-ivr/voice-dashboard/voice-dashboard.component').then(m => m.VoiceDashboardComponent) },
          { path: 'agents',    loadComponent: () => import('./features/voice-ivr/voice-agents/voice-agents.component').then(m => m.VoiceAgentsComponent) },
          { path: 'calls',     loadComponent: () => import('./features/voice-ivr/voice-calls/voice-calls.component').then(m => m.VoiceCallsComponent) },
          { path: 'settings',  loadComponent: () => import('./features/voice-ivr/voice-settings/voice-settings.component').then(m => m.VoiceSettingsComponent) }
        ]
      },
      {
        path: 'automation',
        canActivate: [PermissionGuard, PlanFeatureGuard],
        data: { permissions: ['settings.read'], planFeature: FEATURE_KEY.AUTO_REPLY_ENABLED },
        children: [
          { path: '', loadComponent: () => import('./features/automation/hub/automation-hub.component').then(m => m.AutomationHubComponent) },
          { path: 'ai-replies', loadComponent: () => import('./features/automation/ai-replies/ai-replies.component').then(m => m.AiRepliesComponent) },
          { path: 'growth', loadComponent: () => import('./features/automation/growth/growth.component').then(m => m.GrowthComponent) },
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
          { path: 'reviews', loadComponent: () => import('./features/automation/reviews/review-collection.component').then(m => m.ReviewCollectionComponent) },
          { path: 'retargeting', loadComponent: () => import('./features/automation/retargeting/retargeting.component').then(m => m.RetargetingComponent) },
          { path: 'escalation', loadComponent: () => import('./features/automation/escalation/escalation.component').then(m => m.EscalationComponent) }
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
