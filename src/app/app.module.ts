import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

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
import { InboxListComponent } from './features/inbox/inbox-list/inbox-list.component';
import { InboxDetailComponent } from './features/inbox/inbox-detail/inbox-detail.component';
import { SettingsComponent } from './features/settings/settings.component';
import { AgentsComponent } from './features/agents/agents.component';
import { KnowledgeBaseComponent } from './features/knowledge-base/knowledge-base.component';
import { HomeComponent } from './features/home/home.component';

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
    InboxListComponent,
    InboxDetailComponent,
    SettingsComponent,
    AgentsComponent,
    KnowledgeBaseComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule
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
