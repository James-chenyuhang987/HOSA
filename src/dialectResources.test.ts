import { describe, expect, it } from 'vitest'
import { dialectSpeechResources, speechResourceFor } from './dialectResources'

describe('dialect speech resource index', () => {
  it('keeps one public corpus reference for each supported speech direction', () => {
    expect(dialectSpeechResources).toHaveLength(5)
    for (const dialect of ['mandarin', 'cantonese', 'minnan', 'shanghai', 'sichuan'] as const) {
      const resource = speechResourceFor(dialect)
      expect(resource?.url).toMatch(/^https:\/\/github\.com\//u)
      expect(resource?.purpose).toBeTruthy()
    }
  })

  it('does not pretend the corpus is a translation endpoint', () => {
    expect(dialectSpeechResources.every((resource) => !resource.url.includes('/api'))).toBe(true)
  })
})
