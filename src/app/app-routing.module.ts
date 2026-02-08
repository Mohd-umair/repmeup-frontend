import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';

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
import { PlansComponent } from './features/plans/plans.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { ContactComponent } from './features/contact/contact.component';
import { AboutComponent } from './features/about/about.component';
import { DataDeletionStatusComponent } from './features/data-deletion-status/data-deletion-status.component';

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
      { path: 'google-callback', component: GoogleCallbackComponent }
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
      { path: 'inbox', component: InboxContainerComponent },
            { path: 'publish', component: PublishComponent },
            { path: 'publish/calendar', component: CalendarComponent },
            { path: 'publish/published', component: PublishedPostsComponent },
      { path: 'analytics', component: AnalyticsComponent },
      { path: 'knowledge-base', component: KnowledgeBaseComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'agents', component: AgentsComponent },
      { path: 'plans', component: PlansComponent }
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
