import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

// Explanatory tooltip for buttons (shown on hover and on keyboard focus).
// `side` is one of top | bottom | left | right.
const SIDES = { top: 'tooltip-top', bottom: 'tooltip-bottom', left: 'tooltip-left', right: 'tooltip-right' }

export default function Tooltip({ text, side = 'top', className = '', children }) {
  return (
    <span className={`tooltip ${SIDES[side]} before:max-w-56 before:whitespace-normal before:text-balance ${className}`} data-tip={text}>
      {children}
    </span>
  )
}

const MARGIN = 12 // minimum distance to the screen edges
const GAP = 8 // distance between the icon and the bubble

// Small ⓘ next to a label that explains it. Opens on hover, focus or tap, and is placed
// below the icon (above if there is no room), always kept inside the screen.
export function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const bubbleRef = useRef(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const bubble = bubbleRef.current?.getBoundingClientRect()
      if (!anchor || !bubble) return
      const maxLeft = window.innerWidth - bubble.width - MARGIN
      const left = Math.max(MARGIN, Math.min(anchor.left + anchor.width / 2 - bubble.width / 2, maxLeft))
      const below = anchor.bottom + GAP
      const top = below + bubble.height > window.innerHeight - MARGIN ? anchor.top - GAP - bubble.height : below
      setPos({ left, top })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Close with Escape or a tap anywhere else.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => !buttonRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setPos(null)
  }

  return (
    <span className="inline-block align-middle font-normal normal-case tracking-normal">
      <button
        ref={buttonRef}
        type="button"
        className="inline-grid size-6 cursor-help place-items-center rounded-full opacity-60 hover:opacity-100 focus-visible:opacity-100"
        aria-label={text}
        aria-describedby={open ? id : undefined}
        // Hover only for real mice: after a tap, browsers fire a fake mouseleave that would close it.
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && close()}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 7.5v.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          // whitespace-normal etc.: don't inherit nowrap, bold or uppercase from where the ⓘ sits (e.g. table headers)
          className="fixed z-50 block w-max max-w-[min(18rem,calc(100vw-1.5rem))] whitespace-normal break-words rounded-field bg-neutral px-3 py-2 text-left text-sm font-normal normal-case leading-snug tracking-normal text-neutral-content shadow-lg"
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
