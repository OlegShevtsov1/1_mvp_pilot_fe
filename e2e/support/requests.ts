import type { Page } from '@playwright/test'

export interface RequestRecorder {
  /** Fails when a font or image came from a host that is neither the app nor Google. */
  expectNoThirdPartyAssets(): void
}

const googleHost = /(^|\.)(google|gstatic|googleusercontent|googleapis)\.com$/

export function recordRequests(page: Page): RequestRecorder {
  const assets: { url: string; type: string }[] = []
  page.on('request', (request) => {
    const type = request.resourceType()
    if (type === 'font' || type === 'image') assets.push({ url: request.url(), type })
  })
  return {
    expectNoThirdPartyAssets() {
      const app = new URL(page.url()).host
      const foreign = assets.filter(({ url }) => {
        const { protocol, host, hostname } = new URL(url)
        return (protocol === 'http:' || protocol === 'https:') && host !== app && !googleHost.test(hostname)
      })
      if (foreign.length > 0) {
        throw new Error(`third-party requests: ${foreign.map(({ type, url }) => `${type} ${url}`).join(', ')}`)
      }
    },
  }
}

/** Serves /config.js with the given Google client id, whatever the deployment sets; an empty id turns Google off. */
export async function withGoogleClient(page: Page, clientId: string): Promise<void> {
  await page.route('**/config.js', async (route) => {
    let served = 'window.APP_CONFIG = {};'
    try {
      const response = await route.fetch()
      if (response.ok() && /javascript/.test(response.headers()['content-type'] ?? '')) served = await response.text()
    } catch {
      // No /config.js to start from (a bare preview): the override alone is the config.
    }
    await route.fulfill({
      contentType: 'text/javascript',
      body: `${served}\nwindow.APP_CONFIG = { ...window.APP_CONFIG, GOOGLE_CLIENT_ID: ${JSON.stringify(clientId)} };`,
    })
  })
}
