import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import './App.css'

const CHARS = ' !ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
const ANIM_MS = 300
const CHAIN_MS = 100

const Tile = forwardRef(function Tile({ disabled = false }, ref) {
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
    if (disabled || lockRef.current) return
    tileRef.current?.setPointerCapture(e.pointerId)
    ptrRef.current = { active: true, startY: e.clientY, startTime: Date.now() }
  }

  const onMove = (e) => {
    if (disabled || !ptrRef.current.active) return
    const h = tileRef.current?.clientHeight || 100
    const dy = ptrRef.current.startY - e.clientY

    if (!lockRef.current && Math.abs(dy) > h * 0.25) {
      ptrRef.current.startY = e.clientY
      ptrRef.current.startTime = Date.now()
      doFlip(dy > 0 ? 1 : -1)
    }
  }

  const onUp = (e) => {
    if (disabled || !ptrRef.current.active) return
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

  // --- Initial random flips on mount ---
  useEffect(() => {
    const delay = Math.random() * 1200
    const count = 3 + Math.floor(Math.random() * 8)
    const timer = setTimeout(() => flick(1, count), delay)
    return () => clearTimeout(timer)
  }, [flick])

  // --- Wheel ---
  useEffect(() => {
    const el = tileRef.current
    if (!el) return
    const onWheel = (e) => {
      if (disabled) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? 1 : -1
      const count = Math.min(10, Math.max(1, Math.round(Math.abs(e.deltaY) / 40)))
      flick(dir, count)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [flick, disabled])

  const curChar = CHARS[index]
  const prevChar = CHARS[prev]
  const lowerChar = flipping ? prevChar : curChar

  return (
    <div
      className={`tile${inverted ? ' inverted' : ''}${disabled ? ' disabled' : ''}`}
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

/* ---- Speech recognition hook ---- */
function useSpeechRecognition({ lang = 'en-US' } = {}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    setSupported(true)

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(text)
    }

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-available') {
        setListening(false)
      }
    }

    rec.onend = () => {
      if (recRef.current?._shouldListen) {
        try { rec.start() } catch (e) { /* ignore */ }
      } else {
        setListening(false)
      }
    }

    recRef.current = rec
    recRef.current._shouldListen = false

    return () => {
      try { rec.stop() } catch (e) { /* ignore */ }
    }
  }, [lang])

  const toggle = useCallback(() => {
    const rec = recRef.current
    if (!rec) return

    if (listening) {
      rec._shouldListen = false
      rec.stop()
      setListening(false)
    } else {
      rec._shouldListen = true
      setTranscript('')
      try { rec.start(); setListening(true) } catch (e) { /* ignore */ }
    }
  }, [listening])

  return { listening, supported, transcript, toggle }
}

/* ---- App ---- */
const STAGGER_MS = 30

export default function App() {
  const [grid, setGrid] = useState({ cols: 1, rows: 1 })
  const [mode, setMode] = useState('free')
  const tileRefs = useRef([])
  const prevTextRef = useRef('')

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const tileW = Math.max(50, Math.min(120, w / 7))
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

  const { listening, supported, transcript, toggle } = useSpeechRecognition({
    lang: 'en-US',
  })

  const handleMicClick = useCallback(() => {
    setMode((m) => (m === 'free' ? 'speech' : 'free'))
    toggle()
  }, [toggle])

  // Clear tiles when entering speech mode
  useEffect(() => {
    if (mode === 'speech') {
      prevTextRef.current = ''
      tileRefs.current.forEach((ref, i) => {
        if (!ref) return
        setTimeout(() => ref.flipTo(' '), i * 20)
      })
    }
  }, [mode])

  // Update tiles when transcript changes
  useEffect(() => {
    if (mode !== 'speech') return

    const text = transcript.toUpperCase()
    const prev = prevTextRef.current
    prevTextRef.current = text

    tileRefs.current.forEach((ref, i) => {
      if (!ref) return
      const char = i < text.length ? text[i] : ' '
      const prevChar = i < prev.length ? prev[i] : ' '
      if (char === prevChar) return

      setTimeout(() => ref.flipTo(char), i * STAGGER_MS)
    })
  }, [transcript, mode, totalTiles])

  tileRefs.current = tileRefs.current.slice(0, totalTiles)

  return (
    <>
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
            disabled={mode === 'speech'}
          />
        ))}
      </div>

      {supported && (
        <button
          className={`mic-btn${listening ? ' mic-active' : ''}`}
          onClick={handleMicClick}
          aria-label={listening ? 'Stop speech recognition' : 'Start speech recognition'}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
      )}
    </>
  )
}
