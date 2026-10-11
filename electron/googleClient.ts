import { z } from 'zod';

// Installed-app client credentials identify the publisher, not the signed-in user.
// They are injected into main at build time; user tokens never belong here.
declare const SCHOOLWORK_GOOGLE_CLIENT: unknown;
export const googleDesktopClientSchema = z.object({
  clientId: z.string().trim().regex(/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/),
  clientSecret: z.string().trim().min(1).max(512),
});
export type GoogleDesktopClient = z.infer<typeof googleDesktopClientSchema>;
export function parseGoogleDesktopClient(value: unknown): GoogleDesktopClient | undefined {
  if (value == null) return undefined;
  return googleDesktopClientSchema.parse(value);
}
export const publishedGoogleClient = parseGoogleDesktopClient(
  typeof SCHOOLWORK_GOOGLE_CLIENT === 'undefined' ? undefined : SCHOOLWORK_GOOGLE_CLIENT,
);
