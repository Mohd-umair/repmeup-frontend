/** Platforms not yet available for connection or configuration. */
export const COMING_SOON_PLATFORM_IDS = ['google', 'linkedin'] as const;

export type ComingSoonPlatformId = (typeof COMING_SOON_PLATFORM_IDS)[number];

export const COMING_SOON_PLATFORM_LABEL = 'Coming soon';

export const COMING_SOON_PLATFORM_MESSAGE =
  'This integration is coming soon and is not available yet.';

export function isComingSoonPlatform(platformId: string | null | undefined): boolean {
  if (!platformId) return false;
  return (COMING_SOON_PLATFORM_IDS as readonly string[]).includes(String(platformId).toLowerCase());
}
