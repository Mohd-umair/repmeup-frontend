import { Routes } from '@angular/router';
import { AutomationHubComponent } from './hub/automation-hub.component';
import { AiRepliesComponent } from './ai-replies/ai-replies.component';
import { GrowthComponent } from './growth/growth.component';
import { WhatsAppFlowsComponent } from './whatsapp-flows/whatsapp-flows.component';
import { ReviewCollectionComponent } from './reviews/review-collection.component';
import { RetargetingComponent } from './retargeting/retargeting.component';
import { EscalationComponent } from './escalation/escalation.component';

export const AUTOMATION_ROUTES: Routes = [
  { path: '', component: AutomationHubComponent },
  { path: 'ai-replies', component: AiRepliesComponent },
  { path: 'growth', component: GrowthComponent },
  { path: 'whatsapp-flows', component: WhatsAppFlowsComponent },
  { path: 'reviews', component: ReviewCollectionComponent },
  { path: 'retargeting', component: RetargetingComponent },
  { path: 'escalation', component: EscalationComponent }
];
