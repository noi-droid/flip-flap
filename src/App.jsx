import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import './App.css'

const CHARS = ' !ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ANIM_MS = 300
const CHAIN_MS = 100

const WORDS = [
  'HELLO', 'WORLD', 'FLIP', 'FLAP', 'TIME', 'LOVE', 'PLAY', 'CODE',
  'JAZZ', 'VIBE', 'GLOW', 'RUSH', 'WAVE', 'SPIN', 'ZOOM', 'BOLD',
  'DREAM', 'NIGHT', 'SOUND', 'LIGHT', 'SPACE', 'PIXEL', 'NOISE',
  'GHOST', 'BLOOM', 'SWIFT', 'DRIFT', 'STORM', 'PULSE', 'CRISP',
  'SPARK', 'BLAZE', 'SHINE', 'CHAOS', 'VIVID', 'ORBIT', 'QUEST',
]

function pickRandomWords(cols, rows) {
  const pool = [...WORDS].sort(() => Math.random() - 0.5)
  const picked = []
  let row = 0

  for (const word of pool) {
    if (row >= rows) break
    if (word.length > cols) continue
    picked.push(word)
    row++
  }

  return picked.join(' ')
}

function layoutWords(text, cols, total) {
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const grid = new Array(total).fill(' ')
  let row = 0

  for (const word of words) {
    if (row * cols >= total) break
    let col = 0
    for (let i = 0; i < word.length; i++) {
      const pos = row * cols + col
      if (pos >= total) break
      grid[pos] = word[i]
      col++
      if (col >= cols) { row++; col = 0 }
    }
    row++
  }

  return grid
}

const Tile = forwardRef(function Tile(_, ref) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CHARS.length))
  const [prev, setPrev] = useState(index)
  const [flipping, setFlipping] = useState(false)
  const [flipId, setFlipId] = useState(0)
  const [fast, setFast] = useState(false)
  const [inverted, setInverted] = useState(false)

  const idxRef = useRef(index)
  const lockRef = useRef(false)
  const tileRef = useRef(null)
  const ptrRef = useRef({ active: false, startY: 0, startTime: 0 })
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

  useImperativeHandle(ref, () => ({
    flipTo(char) {
      const targetChar = char.toUpperCase()
      const targetIdx = CHARS.indexOf(targetChar)
      const target = targetIdx === -1 ? 0 : targetIdx
      const current = idxRef.current
      if (current === target) return
      const distance = (target - current + CHARS.length) % CHARS.length
      flick(1, distance)
    }
  }), [flick])

  // --- Pointer events ---
  const onDown = (e) => {
    if (lockRef.current) return
    tileRef.current?.setPointerCapture(e.pointerId)
    ptrRef.current = { active: true, startY: e.clientY, startTime: Date.now() }
  }

  const onMove = (e) => {
    if (!ptrRef.current.active) return
    const h = tileRef.current?.clientHeight || 100
    const dy = ptrRef.current.startY - e.clientY

    if (!lockRef.current && Math.abs(dy) > h * 0.25) {
      ptrRef.current.startY = e.clientY
      ptrRef.current.startTime = Date.now()
      doFlip(dy > 0 ? 1 : -1)
    }
  }

  const onUp = (e) => {
    if (!ptrRef.current.active) return
    ptrRef.current.active = false
    const dy = ptrRef.current.startY - e.clientY
    if (Math.abs(dy) <= 10) {
      setInverted((v) => !v)
      return
    }

    const elapsed = Math.max(1, Date.now() - ptrRef.current.startTime)
    const velocity = Math.abs(dy) / elapsed // px/ms
    const count = Math.min(15, Math.max(1, Math.round(velocity * 6)))

    flick(dy > 0 ? 1 : -1, count)
  }

  // --- Wheel ---
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      const count = Math.min(10, Math.max(1, Math.round(Math.abs(e.deltaY) / 40)))
      flick(dir, count)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [flick])

  const curChar = CHARS[index]
  const prevChar = CHARS[prev]
  const lowerChar = flipping ? prevChar : curChar

  return (
    <div
      className={`tile${inverted ? ' inverted' : ''}`}
      ref={tileRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="half upper">
        <div className="half-text"><span>{curChar}</span></div>
      </div>
      <div className="half lower">
        <div className="half-text"><span>{lowerChar}</span></div>
      </div>

      {flipping && (
        <>
          <div className={`flap flap-top${fast ? ' fast' : ''}`} key={`t${flipId}`}>
            <div className="half-text"><span>{prevChar}</span></div>
          </div>
          <div className={`flap flap-bottom${fast ? ' fast' : ''}`} key={`b${flipId}`}>
            <div className="half-text"><span>{curChar}</span></div>
          </div>
        </>
      )}

      <div className="split-line" />
      <div className="pin pin-l" />
      <div className="pin pin-r" />
    </div>
  )
})

/* ---- App ---- */
const STAGGER_MS = 15

export default function App() {
  const [grid, setGrid] = useState({ cols: 1, rows: 1 })
  const tileRefs = useRef([])
  const initRef = useRef(null)

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

  const totalTiles = grid.cols * grid.rows

  // Flip to initial words on mount
  useEffect(() => {
    if (totalTiles <= 1) return
    if (initRef.current === totalTiles) return
    initRef.current = totalTiles

    const text = pickRandomWords(grid.cols, grid.rows)
    const laid = layoutWords(text, grid.cols, totalTiles)

    // Small delay so refs are ready, then cascade flip to words
    const timer = setTimeout(() => {
      tileRefs.current.forEach((ref, i) => {
        if (!ref) return
        setTimeout(() => ref.flipTo(laid[i]), i * STAGGER_MS)
      })
    }, 50)

    return () => clearTimeout(timer)
  }, [totalTiles, grid.cols, grid.rows])

  tileRefs.current = tileRefs.current.slice(0, totalTiles)

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
      }}
    >
      {Array.from({ length: totalTiles }, (_, i) => (
        <Tile
          key={i}
          ref={(el) => { tileRefs.current[i] = el }}
        />
      ))}
    </div>
  )
}
