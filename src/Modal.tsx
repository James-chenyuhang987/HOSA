import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export default function Modal({ titleId, onClose, children, className = '' }: {
  titleId: string; onClose: () => void; children: ReactNode; className?: string
}) {
  const dialog = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose })
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const getFocusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ) ?? [])
    ;(getFocusable()[0] ?? dialog.current)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = getFocusable()
      if (!items.length) { event.preventDefault(); dialog.current?.focus(); return }
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
    }
    const trapFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) (getFocusable()[0] ?? dialog.current)?.focus()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', trapFocus)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', trapFocus)
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return <div className="onboarding-backdrop" onClick={(event) => {
    if (event.target === event.currentTarget) onClose()
  }}>
    <section className={className} ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      {children}
    </section>
  </div>
}
