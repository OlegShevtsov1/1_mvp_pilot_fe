export interface AppConfig {
  API_URL: string
  SENTRY_DSN: string
  ENV_NAME: string
  APP_VERSION: string
  /** Public Google OAuth client id; empty turns Google sign-in off. */
  GOOGLE_CLIENT_ID: string
  /** Public uid of the OAuth web application, sent as `client_id` on every token grant. */
  OAUTH_CLIENT_ID: string
}

declare global {
  interface Window {
    /** Set by /config.js, which the container writes at start (docker/40-config-js.sh). */
    APP_CONFIG?: Partial<AppConfig>
  }
}

export function readConfig(served: Partial<AppConfig> | undefined): AppConfig {
  return {
    API_URL: (served?.API_URL ?? '').replace(/\/$/, ''),
    SENTRY_DSN: served?.SENTRY_DSN ?? '',
    ENV_NAME: served?.ENV_NAME ?? 'unknown',
    APP_VERSION: served?.APP_VERSION ?? 'local',
    GOOGLE_CLIENT_ID: served?.GOOGLE_CLIENT_ID ?? '',
    OAUTH_CLIENT_ID: served?.OAUTH_CLIENT_ID ?? '',
  }
}
