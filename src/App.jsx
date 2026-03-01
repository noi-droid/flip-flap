import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import './App.css'

const CHARS = ' !ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ANIM_MS = 300
const CHAIN_MS = 100
const GAP = 5
const PAD = 5

const DESTINATIONS = [
  'TOKYO', 'PARIS', 'LONDON', 'CAIRO', 'DUBAI', 'SEOUL', 'ROME',
  'LIMA', 'OSLO', 'BALI', 'DOHA', 'LYON', 'NICE', 'PUNE',
  'BERLIN', 'LISBON', 'SYDNEY', 'MUNICH', 'VIENNA', 'HAVANA',
  'MOSCOW', 'NAIROBI', 'DUBLIN', 'ZURICH', 'PRAGUE', 'ATHENS',
  'MANILA', 'BOGOTA', 'TAIPEI', 'HANOI', 'LAGOS', 'ACCRA',
  'ISTANBUL', 'HELSINKI', 'HONOLULU', 'BANGKOK', 'BEIJING',
  'SHANGHAI', 'FLORENCE', 'MONTREAL', 'EDINBURGH', 'BARCELONA',
  'REYKJAVIK', 'MARRAKECH', 'STOCKHOLM', 'SINGAPORE', 'AMSTERDAM',
  'BUENOS AIRES', 'KUALA LUMPUR', 'SAN FRANCISCO', 'NEW YORK',
  'LOS ANGELES', 'RIO DE JANEIRO', 'JOHANNESBURG', 'COPENHAGEN',
]

function pickRandomDestinations(cols, rows) {
  const fits = DESTINATIONS.filter((d) => d.length <= cols)
  const shuffled = fits.sort(() => Math.random() - 0.5)
  shuffled.sort((a, b) => {
    const aScore = a.length + Math.random() * cols * 0.4
    const bScore = b.length + Math.random() * cols * 0.4
    return bScore - aScore
  })

  const maxRows = Math.max(1, Math.ceil(rows * 0.35))
  const picked = []

  for (const dest of shuffled) {
    if (picked.length >= maxRows) break
    picked.push(dest)
  }

  return picked
}

function layoutLines(lines, cols, rows) {
  const total = cols * rows
  const grid = new Array(total).fill(' ')

  const allRows = Array.from({ length: rows }, (_, i) => i)
  for (let i = allRows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allRows[i], allRows[j]] = [allRows[j], allRows[i]]
  }
  const selectedRows = allRows.slice(0, lines.length).sort((a, b) => a - b)

  lines.forEach((line, idx) => {
    const row = selectedRows[idx]
    for (let i = 0; i < line.length && i < cols; i++) {
      const pos = row * cols + i
      if (pos < total) grid[pos] = line[i]
    }
  })

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
  const empty = !flipping && curChar === ' '

  return (
    <div
      className={`tile${inverted ? ' inverted' : ''}${empty ? ' empty' : ''}`}
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

  const tileRects = useMemo(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    const contentW = w - 2 * PAD
    const contentH = h - 2 * PAD
    const cellW = (contentW - (grid.cols - 1) * GAP) / grid.cols
    const cellH = (contentH - (grid.rows - 1) * GAP) / grid.rows
    const rects = []
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        rects.push({
          x: PAD + c * (cellW + GAP) - 0.5,
          y: PAD + r * (cellH + GAP) - 0.5,
          w: cellW + 1,
          h: cellH + 1,
        })
      }
    }
    return rects
  }, [grid.cols, grid.rows])

  // Flip to initial words on mount
  useEffect(() => {
    if (totalTiles <= 1) return
    if (initRef.current === totalTiles) return
    initRef.current = totalTiles

    const lines = pickRandomDestinations(grid.cols, grid.rows)
    const laid = layoutLines(lines, grid.cols, grid.rows)

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
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="tile-mask" clipPathUnits="userSpaceOnUse">
            {tileRects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={5} />
            ))}
          </clipPath>
        </defs>
      </svg>
      <video
        className="bg-video"
        src="/images/video1.mp4"
        autoPlay
        muted
        loop
        playsInline
        style={{ clipPath: 'url(#tile-mask)' }}
      />
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
    </>
  )
}
