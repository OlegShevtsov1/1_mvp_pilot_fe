import { expect, test } from '@playwright/test'
import { apiUrl } from './apiUrl.ts'

test('the app origin can call the API cross-origin', async ({ page }) => {
  const corsMessages: string[] = []
  page.on('console', (message) => {
    if (/CORS|blocked/i.test(message.text())) corsMessages.push(message.text())
  })
  const api = await apiUrl(page)

  const health = page.waitForResponse((response) => response.url() === `${api}/health`)
  const body = await page.evaluate((url) => fetch(url).then((reply) => reply.json()), `${api}/health`)
  const response = await health

  expect(response.status()).toBe(200)
  expect(response.headers()['access-control-allow-origin']).toBe(new URL(page.url()).origin)
  expect(body.status).toBe('ok')
  expect(corsMessages).toEqual([])
})

test('the API does not allow a foreign origin', async ({ page, request }) => {
  const api = await apiUrl(page)
  const response = await request.get(`${api}/health`, { headers: { Origin: 'https://evil.example.com' } })
  expect(response.status()).toBe(200)
  expect(response.headers()['access-control-allow-origin']).toBeUndefined()
})
