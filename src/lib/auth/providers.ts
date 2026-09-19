/**
 * OAuth providers via the Grok broker.
 * Empty on purpose: Google/X cannot redirect back on younggunzgolf.com.
 * Sign-in is email/password + guest mode.
 */
export type GrokProvider = {
  providerId: string;
  idp: string;
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [];
