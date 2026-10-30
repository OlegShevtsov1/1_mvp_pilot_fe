import { expect, type Locator, type Page } from '@playwright/test'

const maxShellWidth = 1200

/** The page does not scroll sideways at each width: its content fits the viewport. */
export async function expectNoSidewaysScroll(page: Page, widths: number[] = [360, 768]): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(scroll, `scrollWidth at ${width} px`).toBeLessThanOrEqual(client)
  }
}

/** The shell is at most 1200 px wide, with equal margins left and right, and nothing is cut off. */
export async function expectCentredShell(page: Page, shell: Locator): Promise<void> {
  const box = await shell.boundingBox()
  expect(box, 'the shell is on the page').not.toBeNull()
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(box!.width, 'shell width').toBeLessThanOrEqual(maxShellWidth)
  expect(Math.abs(box!.x - (client - box!.x - box!.width)), 'left and right margins differ').toBeLessThanOrEqual(1)
  expect(scroll, 'content is cut off').toBeLessThanOrEqual(client)
}
