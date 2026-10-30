import type { Page } from '@playwright/test'

export const headline = 'Every project and every task in one calm place'

// The landing offers Google only where the runtime config turns Google sign-in on (dev, not prod).
export async function heroStarts(page: Page) {
  const google = Boolean(await page.evaluate(() => window.APP_CONFIG?.GOOGLE_CLIENT_ID))
  const hero = page.getByRole('region', { name: headline })
  const names = google ? ['Continue with Google', 'Sign up with email and password'] : ['Sign up', 'Sign in']
  const starts = names.map((name) => hero.getByRole('link', { name, exact: true }))
  return { google, starts, emailSignUp: starts[google ? 1 : 0] }
}
