import { expect, type Page } from '@playwright/test'

function brightness(colour: string): number {
  const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).map(Number)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The page asks the device for its theme: the light and the dark scheme give different, matching backgrounds. */
export async function expectFollowsDeviceTheme(page: Page): Promise<void> {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const asksForDark = () => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)

  await page.emulateMedia({ colorScheme: 'light' })
  expect(await asksForDark(), 'light scheme emulated').toBe(false)
  const light = await background()
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await asksForDark(), 'dark scheme emulated').toBe(true)
  const dark = await background()

  expect(light, 'background in the two themes').not.toBe(dark)
  expect(brightness(light), 'the light theme is lighter than the dark one').toBeGreaterThan(brightness(dark))
}
