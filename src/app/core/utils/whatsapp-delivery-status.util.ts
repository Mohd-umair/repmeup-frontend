import { IReply } from '../models/interaction.model';

export type WhatsAppDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Resolve outbound WhatsApp tick state from reply fields + Meta webhook deliveryStatus. */
export function resolveWhatsAppDeliveryStatus(
  reply: Pick<IReply, 'status' | 'deliveryStatus' | 'platformResponseId'> | null | undefined
): WhatsAppDeliveryStatus {
  if (!reply) return 'pending';
  if (reply.status === 'failed' || reply.deliveryStatus === 'failed') return 'failed';
  if (reply.status === 'pending') return 'pending';

  const webhookStatus = reply.deliveryStatus;
  if (webhookStatus === 'read' || webhookStatus === 'delivered' || webhookStatus === 'sent') {
    return webhookStatus;
  }

  // Accepted by Meta (wamid) but delivery webhook not received yet → single tick
  if (reply.platformResponseId) return 'sent';
  if (reply.status === 'sent') return 'sent';
  return 'pending';
}

export function whatsAppDeliveryStatusLabel(status: WhatsAppDeliveryStatus): string {
  switch (status) {
    case 'pending':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'failed':
      return 'Not delivered';
    default:
      return 'Message status';
  }
}
