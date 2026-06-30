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

// Non-standalone components declared by this module. Everything else is a standalone
// component lazy-loaded by the router (see app-routing.module.ts) and must NOT be
// imported here, or it would be pulled back into the initial bundle.
import { GoogleCallbackComponent } from './features/auth/google-callback/google-callback.component';
import { ImpersonateCallbackComponent } from './features/auth/impersonate-callback/impersonate-callback.component';
import { AgentsComponent } from './features/agents/agents.component';
import { PrivacyPolicyComponent } from './features/legal/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './features/legal/terms-conditions/terms-conditions.component';
import { RefundCancellationPolicyComponent } from './features/legal/refund-cancellation-policy/refund-cancellation-policy.component';
import { AboutComponent } from './features/about/about.component';
import { FaqComponent } from './features/faq/faq.component';
import { AiCreditsComponent } from './features/ai-credits/ai-credits.component';

// Eager layout shells (used as route containers) + standalone components referenced
// by the declared components above (app-pagination, app-upgrade-prompt).
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { MainLayoutComponent } from './shared/components/main-layout/main-layout.component';
import { UpgradePromptComponent } from './shared/components/upgrade-prompt/upgrade-prompt.component';

// Interceptors
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { LoaderInterceptor } from './core/interceptors/loader.interceptor';

/**
 * App Module - Following SOLID principles
 * Main application module with all necessary imports and providers
 */
@NgModule({
  declarations: [
    AppComponent,
    GoogleCallbackComponent,
    ImpersonateCallbackComponent,
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
    // Standalone components used by the declared components' templates / eager shells:
    SidebarComponent,
    HeaderComponent,
    MainLayoutComponent,
    PublicSiteShellComponent,
    PaginationComponent,
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
