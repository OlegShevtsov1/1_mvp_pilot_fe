// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

// A busy CI runner can hold the event loop for seconds; when it lets go, the overdue query timeout runs before
// React's scheduled commit, so a query whose budget is shorter than the stall fails although the screen is right.
const stallMs = 1_500

function stall() {
  const end = performance.now() + stallMs
  while (performance.now() < end) {
    // the runner is busy
  }
}

function AfterStall() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let answer: ReturnType<typeof setTimeout> | undefined
    const busy = setTimeout(() => {
      stall()
      answer = setTimeout(() => setReady(true))
    })
    return () => {
      clearTimeout(busy)
      clearTimeout(answer)
    }
  }, [])
  return <h1>{ready ? 'Ready' : 'Loading…'}</h1>
}

describe('async UI queries on a busy runner', () => {
  afterEach(cleanup)

  it('a findBy query finds what appears after the runner stalled for longer than a second', async () => {
    render(<AfterStall />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Ready' })).toBeTruthy()
  })

  it('a waitFor check passes once the screen updates after the runner stalled for longer than a second', async () => {
    render(<AfterStall />)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ready'))
  })
})
