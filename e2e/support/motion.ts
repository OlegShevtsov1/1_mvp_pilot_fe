import { expect, type Page } from '@playwright/test'

const google = '[data-testid="google-button"]'

/** Under reduced motion no element, nor its ::before and ::after, has an animation or a transition running. */
export async function expectNoMotionUnderReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const moving = await page.evaluate((skip) => {
    const found: string[] = []
    for (const element of Array.from(document.querySelectorAll('body, body *'))) {
      if (element.closest(skip)) continue
      for (const pseudo of [null, '::before', '::after']) {
        const style = getComputedStyle(element, pseudo)
        const label = `<${element.tagName.toLowerCase()} class="${element.getAttribute('class') ?? ''}">${pseudo ?? ''}`
        if (style.animationName.split(',').some((name) => name.trim() !== 'none')) found.push(`${label} animation-name: ${style.animationName}`)
        if (style.transitionDuration.split(',').some((time) => parseFloat(time) > 0)) found.push(`${label} transition-duration: ${style.transitionDuration}`)
      }
    }
    return found
  }, google)
  expect(moving, 'elements that animate or transition under reduced motion').toEqual([])
}
