import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';

// Layout
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';

// Feature Components
import { HomeComponent } from './features/home/home.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { InboxContainerComponent } from './features/inbox/inbox-container/inbox-container.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';

/**
 * App Routing Module - Following SOLID principles
 * Defines all application routes with proper guards
 */
const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent },
  { path: 'home', component: HomeComponent },
  
  // Auth routes (public)
  {
    path: 'auth',
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent }
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
      { path: 'knowledge-base', component: KnowledgeBaseComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'agents', component: AgentsComponent }
      // TODO: Add analytics route when component is ready
      // { path: 'analytics', component: AnalyticsComponent }
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
