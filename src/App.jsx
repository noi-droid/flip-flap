import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'

const CHARS = ' !ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ANIM_MS = 300
const CHAIN_MS = 100

const WORDS = [
  'HELLO', 'WORLD', 'FLIP', 'FLAP', 'SPLIT',
  'BOARD', 'CODE', 'REACT', 'JAZZ', 'PIXEL',
  'QUICK', 'ZEBRA', 'GLYPH', 'NIGHT', 'STORM',
  'DREAM', 'LIGHT', 'SPACE', 'DRIFT', 'GHOST',
]

function generateBoard(cols, rows) {
  const board = Array.from({ length: rows * cols }, () => ' ')
  const pool = [...WORDS].sort(() => Math.random() - 0.5)
  let wi = 0

  for (let r = 0; r < rows && wi < pool.length; r++) {
    if (Math.random() < 0.35) continue

    let col = Math.floor(Math.random() * Math.max(1, cols - 6))

    while (col < cols && wi < pool.length) {
      const word = pool[wi]
      if (col + word.length > cols) break

      for (let i = 0; i < word.length; i++) {
        board[r * cols + col + i] = word[i]
      }
      wi++
      col += word.length + Math.floor(Math.random() * 4) + 2

      if (Math.random() < 0.5) break
    }
  }

  return board
}

function useHalf(initialIdx) {
  const [index, setIndex] = useState(initialIdx)
  const [prev, setPrev] = useState(initialIdx)
  const [flipping, setFlipping] = useState(false)
  const [flipId, setFlipId] = useState(0)
  const [fast, setFast] = useState(false)

  const idxRef = useRef(initialIdx)
  const lockRef = useRef(false)
  const queueRef = useRef(0)
  const dirRef = useRef(0)

  const wrap = (i) => ((i % CHARS.length) + CHARS.length) % CHARS.length

  const doFlip = useCallback((dir) => {
    if (lockRef.current) return
    lockRef.current = true

    const cur = idxRef.current
    const next = wrap(cur + dir)
    const willChain = queueRef.current > 0

    setPrev(cur)
    idxRef.current = next
    setIndex(next)
    setFlipId((id) => id + 1)
    setFast(willChain)
    setFlipping(true)

    const ms = willChain ? CHAIN_MS : ANIM_MS
    setTimeout(() => {
      setFlipping(false)
      lockRef.current = false
      if (queueRef.current > 0) {
        queueRef.current--
        requestAnimationFrame(() => doFlip(dirRef.current))
      }
    }, ms)
  }, [])

  const flick = useCallback((dir, count) => {
    dirRef.current = dir
    if (lockRef.current) {
      queueRef.current = count
    } else {
      queueRef.current = Math.max(0, count - 1)
      doFlip(dir)
    }
  }, [doFlip])

  const flipTo = useCallback((targetIdx) => {
    const cur = idxRef.current
    const target = ((targetIdx % CHARS.length) + CHARS.length) % CHARS.length
    if (cur === target) return
    const fwd = (target - cur + CHARS.length) % CHARS.length
    const bwd = (cur - target + CHARS.length) % CHARS.length
    if (fwd <= bwd) {
      flick(1, fwd)
    } else {
      flick(-1, bwd)
    }
  }, [flick])

  return { index, prev, flipping, flipId, fast, flick, flipTo, doFlip, lockRef, idxRef }
}

function Tile({ target = ' ' }) {
  const targetIdx = Math.max(0, CHARS.indexOf(target))
  const [startIdx] = useState(() => Math.floor(Math.random() * CHARS.length))

  const upper = useHalf(startIdx)
  const lower = useHalf(startIdx)
  const [mismatched, setMismatched] = useState(false)

  const tileRef = useRef(null)
  const ptrRef = useRef({ active: false, startY: 0, startTime: 0 })
  const initRef = useRef(false)

  // --- Initial shuffle → land on target ---
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const dist = (targetIdx - startIdx + CHARS.length) % CHARS.length
    const count = dist < 10 ? dist + CHARS.length : dist
    upper.flick(1, count)
    lower.flick(1, count)
  }, [])

  // --- Pointer events ---
  const onDown = (e) => {
    if (upper.lockRef.current && lower.lockRef.current) return
    tileRef.current?.setPointerCapture(e.pointerId)
    ptrRef.current = { active: true, startY: e.clientY, startTime: Date.now() }
  }

  const onMove = (e) => {
    if (!ptrRef.current.active) return
    const h = tileRef.current?.clientHeight || 100
    const dy = ptrRef.current.startY - e.clientY

    if (!upper.lockRef.current && Math.abs(dy) > h * 0.25) {
      ptrRef.current.startY = e.clientY
      ptrRef.current.startTime = Date.now()
      const dir = dy > 0 ? 1 : -1
      upper.doFlip(dir)
      lower.doFlip(dir)
    }
  }

  const onUp = (e) => {
    if (!ptrRef.current.active) return
    ptrRef.current.active = false
    const dy = ptrRef.current.startY - e.clientY
    if (Math.abs(dy) <= 10) {
      if (upper.lockRef.current || lower.lockRef.current) return
      if (!mismatched) {
        // Both flip → end on different chars
        const upperOff = Math.floor(Math.random() * 10) + 3
        const extraOff = Math.floor(Math.random() * (CHARS.length - 2)) + 1
        upper.flick(1, upperOff)
        lower.flick(1, upperOff + extraOff)
        setMismatched(true)
      } else {
        // Both flip → converge to same char
        const n = Math.floor(Math.random() * 5) + 3
        const dest = (upper.idxRef.current + n) % CHARS.length
        upper.flick(1, n)
        const lowerDist = (dest - lower.idxRef.current + CHARS.length) % CHARS.length
        lower.flick(1, lowerDist < 3 ? lowerDist + CHARS.length : lowerDist)
        setMismatched(false)
      }
      return
    }

    const elapsed = Math.max(1, Date.now() - ptrRef.current.startTime)
    const velocity = Math.abs(dy) / elapsed
    const count = Math.min(15, Math.max(1, Math.round(velocity * 6)))
    const dir = dy > 0 ? 1 : -1

    upper.flick(dir, count)
    lower.flick(dir, count)
  }

  // --- Wheel ---
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      const count = Math.min(10, Math.max(1, Math.round(Math.abs(e.deltaY) / 40)))
      upper.flick(dir, count)
      lower.flick(dir, count)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [upper.flick, lower.flick])

  const upperChar = CHARS[upper.index]
  const lowerChar = CHARS[lower.index]
  const prevUpperChar = CHARS[upper.prev]
  const prevLowerChar = CHARS[lower.prev]
  return (
    <div
      className="tile"
      ref={tileRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="half upper">
        <div className="half-text"><span>{upperChar}</span></div>
      </div>
      <div className="half lower">
        <div className="half-text"><span>{lower.flipping ? prevLowerChar : lowerChar}</span></div>
      </div>

      {upper.flipping && (
        <div className={`flap flap-top${upper.fast ? ' fast' : ''}`} key={`t${upper.flipId}`}>
          <div className="half-text"><span>{prevUpperChar}</span></div>
        </div>
      )}
      {lower.flipping && (
        <div className={`flap flap-bottom${lower.fast ? ' fast' : ''}`} key={`b${lower.flipId}`}>
          <div className="half-text"><span>{lowerChar}</span></div>
        </div>
      )}

      <div className="split-line" />
      <div className="pin pin-l" />
      <div className="pin pin-r" />
    </div>
  )
}

/* ---- App ---- */
export default function App() {
  const [grid, setGrid] = useState({ cols: 1, rows: 1 })

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const tileW = Math.max(36, Math.min(80, w / 10))
      const tileH = tileW / 0.72
      setGrid({
        cols: Math.max(2, Math.floor(w / tileW)),
        rows: Math.max(2, Math.floor(h / tileH)),
      })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const board = useMemo(
    () => generateBoard(grid.cols, grid.rows),
    [grid.cols, grid.rows]
  )

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
      }}
    >
      {board.map((char, i) => (
        <Tile key={`${grid.cols}-${grid.rows}-${i}`} target={char} />
      ))}
    </div>
  )
}
