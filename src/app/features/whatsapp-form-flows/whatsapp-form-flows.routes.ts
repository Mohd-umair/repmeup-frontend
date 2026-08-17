import { Routes } from '@angular/router';
import { FlowListComponent } from './flow-list/flow-list.component';
import { FlowEditorComponent } from './flow-editor/flow-editor.component';

export const WHATSAPP_FORM_FLOWS_ROUTES: Routes = [
  {
    path: '',
    component: FlowListComponent,
    data: { title: 'WhatsApp Form Flows' }
  },
  {
    path: 'create',
    component: FlowEditorComponent,
    data: { title: 'Create Flow' }
  },
  {
    path: ':id/edit',
    component: FlowEditorComponent,
    data: { title: 'Edit Flow' }
  }
];
