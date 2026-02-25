import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ANIM_MS = 320

function Tile() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CHARS.length))
  const [prev, setPrev] = useState(index)
  const [flipping, setFlipping] = useState(false)
  const [flipId, setFlipId] = useState(0)

  const idxRef = useRef(index)
  const lockRef = useRef(false)
  const tileRef = useRef(null)
  const ptrRef = useRef({ active: false, startY: 0 })

  const wrap = (i) => ((i % CHARS.length) + CHARS.length) % CHARS.length

  const doFlip = useCallback((dir) => {
    if (lockRef.current) return
    lockRef.current = true

    const cur = idxRef.current
    const next = wrap(cur + dir)
    setPrev(cur)
    idxRef.current = next
    setIndex(next)
    setFlipId((id) => id + 1)
    setFlipping(true)

    setTimeout(() => {
      setFlipping(false)
      lockRef.current = false
    }, ANIM_MS)
  }, [])

  // --- Pointer events ---
  const onDown = (e) => {
    if (lockRef.current) return
    tileRef.current?.setPointerCapture(e.pointerId)
    ptrRef.current = { active: true, startY: e.clientY }
  }

  const onMove = (e) => {
    if (!ptrRef.current.active) return
    const h = tileRef.current?.clientHeight || 100
    const dy = ptrRef.current.startY - e.clientY

    if (!lockRef.current && Math.abs(dy) > h * 0.25) {
      ptrRef.current.startY = e.clientY
      doFlip(dy > 0 ? 1 : -1)
    }
  }

  const onUp = (e) => {
    if (!ptrRef.current.active) return
    ptrRef.current.active = false
    const dy = ptrRef.current.startY - e.clientY
    if (!lockRef.current && Math.abs(dy) > 10) {
      doFlip(dy > 0 ? 1 : -1)
    }
  }

  // --- Wheel ---
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      doFlip(e.deltaY > 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [doFlip])

  const curChar = CHARS[index]
  const prevChar = CHARS[prev]

  /*
   * Split-flap animation logic:
   *   Static upper  → always shows NEW char (hidden behind flap-top initially)
   *   Static lower  → shows OLD char during flip, NEW char after
   *   flap-top      → OLD char top half, folds downward to reveal static upper
   *   flap-bottom   → NEW char bottom half, unfolds to cover static lower
   */
  const lowerChar = flipping ? prevChar : curChar

  return (
    <div
      className="tile"
      ref={tileRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* Static upper: NEW char top half */}
      <div className="half upper">
        <div className="half-text">
          <span>{curChar}</span>
        </div>
      </div>

      {/* Static lower: OLD char during flip, NEW char after */}
      <div className="half lower">
        <div className="half-text">
          <span>{lowerChar}</span>
        </div>
      </div>

      {/* Animated flaps */}
      {flipping && (
        <>
          <div className="flap flap-top" key={`t${flipId}`}>
            <div className="half-text">
              <span>{prevChar}</span>
            </div>
          </div>
          <div className="flap flap-bottom" key={`b${flipId}`}>
            <div className="half-text">
              <span>{curChar}</span>
            </div>
          </div>
        </>
      )}

      <div className="split-line" />
      <div className="pin pin-l" />
      <div className="pin pin-r" />
    </div>
  )
}

export default function App() {
  const [grid, setGrid] = useState({ cols: 1, rows: 1 })

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      // Tile aspect ratio ~0.55 (tall portrait, like real Solari boards)
      const tileW = Math.max(50, Math.min(120, w / 7))
      const tileH = tileW / 0.55
      setGrid({
        cols: Math.max(2, Math.floor(w / tileW)),
        rows: Math.max(2, Math.floor(h / tileH)),
      })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
      }}
    >
      {Array.from({ length: grid.cols * grid.rows }, (_, i) => (
        <Tile key={i} />
      ))}
    </div>
  )
}
