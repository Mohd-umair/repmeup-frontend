import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface TroubleshootingIssue {
  title: string;
  summary: string;
  symptoms: string[];
  steps: string[];
}

@Component({
  selector: 'app-platform-troubleshooting',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './platform-troubleshooting.component.html'
})
export class PlatformTroubleshootingComponent {
  readonly quickChecks: string[] = [
    'Use a different Instagram account to send your test DM. Messages you send from the connected business account come back as echo events and should not create a new inbox conversation.',
    'Keep one Instagram account on one connection flow only. Do not connect the same Instagram professional account through both Facebook Login and Instagram Login.',
    'Reconnect after changing Meta permissions or app setup so your stored token matches the latest scopes and webhook ownership.',
    'Use a Business or Creator Instagram profile for Instagram Login.'
  ];

  readonly issues: TroubleshootingIssue[] = [
    {
      title: 'Messages reach webhook but do not show in the inbox',
      summary: 'This usually means the webhook event was an echo, a message edit, or the event matched a different Instagram account than the one connected in your workspace.',
      symptoms: [
        'Logs show is_echo: true',
        'Logs show message_edit instead of message',
        'Logs show "No active Instagram Login connection for account ..."'
      ],
      steps: [
        'Send a new DM from a different Instagram account to the connected business account.',
        'Remove stale entries from Instagram -> Settings -> Apps and websites so Meta stops sending events for old accounts.',
        'If the log says "No active Instagram Login connection", reconnect the correct Instagram account in Settings -> Platforms.'
      ]
    },
    {
      title: 'Reply fails with thread owner error 2534037',
      summary: 'Meta believes another app or older connection path owns that Instagram conversation thread.',
      symptoms: [
        'Reply API returns error_subcode 2534037',
        'Receive works, inbox works, but reply fails',
        'The same Instagram account was previously connected through a different Meta app or Facebook Login path'
      ],
      steps: [
        'Do not connect the same Instagram account through both Facebook Login and Instagram Login.',
        'Disconnect the Instagram account from the old connection path first, then reconnect it only through the flow you want to keep.',
        'If this affects a legacy Instagram account only, test with a brand new professional account. If the new account works, the issue is Meta-side ownership history for the old account.'
      ]
    },
    {
      title: 'I see multiple webhook events for one message',
      summary: 'Meta commonly sends the real inbound message plus additional webhook events such as echo or message_edit for the same thread.',
      symptoms: [
        'One real message event followed by message_edit',
        'Extra events with is_echo: true',
        'Only one interaction should be created in the inbox'
      ],
      steps: [
        'Treat the plain message event as the real inbound message.',
        'Ignore echo and message_edit events when checking whether inbox creation is working.',
        'If interactions duplicate, raise a support ticket with the relevant message mid and timestamps.'
      ]
    },
    {
      title: 'A different Instagram account keeps sending webhook noise',
      summary: 'Meta still has an old authorization for another Instagram account, so your app receives events that do not belong to the current workspace connection.',
      symptoms: [
        'Logs repeatedly show a different Instagram account id',
        'Logs say "No active Instagram Login connection for account ..."',
        'The extra account is no longer connected inside Repmeup'
      ],
      steps: [
        'Open Instagram -> Settings and privacy -> Apps and websites.',
        'Remove any old Repmeup or Repmeup-IG authorization that does not belong to the account you want to keep.',
        'Reconnect the correct Instagram account from Settings -> Platforms if needed.'
      ]
    },
    {
      title: 'Will my old Meta app review approval cover this new flow?',
      summary: 'No. App review approval is tied to the specific Meta app and permission set.',
      symptoms: [
        'You created a separate Meta app for Instagram Login',
        'The older app was approved already but the new app is still in development mode'
      ],
      steps: [
        'Submit the Instagram Login app for its own review before rolling the feature out broadly.',
        'Request the permissions your flow uses, such as instagram_business_basic, instagram_business_manage_messages, and instagram_business_manage_comments.',
        'Use testers, admins, or manually added accounts only for development testing until approval is complete.'
      ]
    }
  ];
}
