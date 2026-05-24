import {
  trigger,
  transition,
  style,
  animate,
  AnimationTriggerMetadata,
} from '@angular/animations';

/**
 * Slides the reply toolbar icon plate to the right from the toggle button and fades in.
 */
const replyToolbarPopover: AnimationTriggerMetadata = trigger('replyToolbarPopover', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-8px) scale(0.96)', transformOrigin: 'left center' }),
    animate(
      '200ms cubic-bezier(0.4, 0, 0.2, 1)',
      style({ opacity: 1, transform: 'translateX(0) scale(1)', transformOrigin: 'left center' })
    ),
  ]),
  transition(':leave', [
    animate(
      '160ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateX(-6px) scale(0.96)', transformOrigin: 'left center' })
    ),
  ]),
]);

/**
 * Slides the emoji picker panel upward above the toolbar plate and fades in.
 */
const emojiPanelPopover: AnimationTriggerMetadata = trigger('emojiPanelPopover', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(6px) scale(0.97)', transformOrigin: 'bottom center' }),
    animate(
      '180ms cubic-bezier(0.4, 0, 0.2, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)', transformOrigin: 'bottom center' })
    ),
  ]),
  transition(':leave', [
    animate(
      '140ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateY(4px) scale(0.97)', transformOrigin: 'bottom center' })
    ),
  ]),
]);

/**
 * Fades the product picker modal backdrop in and out.
 */
const inboxModalBackdrop: AnimationTriggerMetadata = trigger('inboxModalBackdrop', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('160ms ease-in', style({ opacity: 0 })),
  ]),
]);

/**
 * Scales the product picker modal card in from slightly small and fades it in.
 */
const inboxModalPanel: AnimationTriggerMetadata = trigger('inboxModalPanel', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
    animate(
      '220ms cubic-bezier(0.4, 0, 0.2, 1)',
      style({ opacity: 1, transform: 'scale(1) translateY(0)' })
    ),
  ]),
  transition(':leave', [
    animate(
      '160ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' })
    ),
  ]),
]);

/** All animations needed by InboxDetailComponent. */
export const INBOX_DETAIL_ANIMATIONS: AnimationTriggerMetadata[] = [
  replyToolbarPopover,
  emojiPanelPopover,
  inboxModalBackdrop,
  inboxModalPanel,
];

/** Subset of animations needed by InboxBucketViewComponent (emoji panel only). */
export const INBOX_BUCKET_ANIMATIONS: AnimationTriggerMetadata[] = [
  emojiPanelPopover,
];
