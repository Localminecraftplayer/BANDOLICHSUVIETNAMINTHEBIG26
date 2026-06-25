const SPEAKER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`
const STOP_ICON    = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`

let gTTSAudio = null

function chunkText(text, max) {
  const out = []
  text = text.trim()
  while (text.length > max) {
    let i = text.lastIndexOf(' ', max)
    if (i < max * 0.5) i = max
    out.push(text.slice(0, i))
    text = text.slice(i).trimStart()
  }
  if (text) out.push(text)
  return out
}

function stopGTTS() {
  if (gTTSAudio) { gTTSAudio.pause(); gTTSAudio = null }
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}

function getBestVietnameseVoice() {
  const voices = speechSynthesis.getVoices()
  // Prefer neural/online voices (Edge, Chrome with online voices)
  return voices.find(v => v.lang.startsWith('vi') && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')))
    || voices.find(v => v.lang.startsWith('vi'))
    || null
}

function speakWebSpeech(text, onEnd) {
  if (!('speechSynthesis' in window)) { if (onEnd) onEnd(); return }
  speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(expandForTTS(text))
  utt.lang = 'vi-VN'
  const v = getBestVietnameseVoice()
  if (v) utt.voice = v
  utt.rate = 0.9
  utt.onend = utt.onerror = () => { if (onEnd) onEnd() }
  speechSynthesis.speak(utt)
}

const FPT_KEY   = '9GHTAvTe8QhtNIG9a5j4Le3LT2ZArFsm'
const FPT_VOICE = 'banmai'

function expandForTTS(text) {
  return text
    .replace(/\bTCN\b/g, 'Trước Công Nguyên')
    .replace(/\bSCN\b/g, 'Sau Công Nguyên')
    .replace(/\bCN\b/g, 'Công Nguyên')
    .replace(/\bTK\b/g, 'Thế kỷ')
    .replace(/\bTP\.?\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bHCM\b/g, 'Hồ Chí Minh')
    .replace(/\bVN\b/g, 'Việt Nam')
    .replace(/\bĐCS\b/g, 'Đảng Cộng Sản')
    .replace(/\bCHXHCNVN\b/g, 'Cộng hòa Xã hội Chủ nghĩa Việt Nam')
    .replace(/\bVNDCCH\b/g, 'Việt Nam Dân chủ Cộng hòa')
}

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

async function fptTTSDirect(text) {
  const resp = await fetch('https://api.fpt.ai/hmi/tts/v5', {
    method: 'POST',
    headers: {
      'api-key': CONFIG.FPT_KEY,
      'voice':   CONFIG.FPT_VOICE || 'minhquang',
      'speed':   '',
      'Content-Type': 'text/plain'
    },
    body: text
  })
  if (!resp.ok) throw new Error('FPT API ' + resp.status)
  const data = await resp.json()
  const asyncUrl = data.async
  if (!asyncUrl) throw new Error('no async url')
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 800))
    try {
      const ar = await fetch(asyncUrl)
      if (ar.ok) return URL.createObjectURL(await ar.blob())
    } catch {}
  }
  throw new Error('audio never ready')
}

function gTTS(text, onEnd) {
  stopGTTS()
  text = expandForTTS(text)
  const chunks = chunkText(text, 500)
  let i = 0

  function playUrl(url, objectUrl) {
    const a = new Audio(url)
    gTTSAudio = a
    let settled = false
    const chunk0 = chunks[0]
    function once(fn) {
      return () => {
        if (!settled) {
          settled = true
          gTTSAudio = null
          if (objectUrl) URL.revokeObjectURL(objectUrl)
          fn()
        }
      }
    }
    a.onended = once(nextChunk)
    a.onerror = once(() => { i === 1 ? speakWebSpeech(text, onEnd) : nextChunk() })
    a.play().catch(once(() => { i === 1 ? speakWebSpeech(text, onEnd) : nextChunk() }))
  }

  function nextChunk() {
    if (i >= chunks.length) { if (onEnd) onEnd(); return }
    const chunk = chunks[i++]
    if (IS_LOCAL) {
      playUrl('/tts?q=' + encodeURIComponent(chunk), null)
    } else {
      fptTTSDirect(chunk)
        .then(objUrl => { if (gTTSAudio !== null || i === 1) playUrl(objUrl, objUrl) })
        .catch(() => { i === 1 ? speakWebSpeech(text, onEnd) : nextChunk() })
    }
  }

  nextChunk()
}

// ============================================================
// HISTORICAL PERIODS
// ============================================================
// Year each province formally entered Vietnamese control (for historical map shading)
const PROVINCE_YEAR = {
  'Ha Noi': -2879, 'Phu Tho': -2879, 'Bac Ninh': -2879, 'Hung Yen': -2879,
  'Ninh Binh': -2879, 'Quang Ninh': -2879, 'Hai Phong': -2879,
  'Cao Bang': -2879, 'Lang Son': -2879, 'Thai Nguyen': -2879,
  'Tuyen Quang': -2879, 'Lao Cai': -2879, 'Lai Chau': -2879,
  'Dien Bien': -2879, 'Son La': -2879,
  'Thanh Hoa': -2879, 'Nghe An': -2879, 'Ha Tinh': -2879,
  'Quang Tri': 1306, 'Hue': 1306,
  'Da Nang': 1471, 'Quang Ngai': 1471,
  'Khanh Hoa': 1653,
  'Dong Nai': 1698, 'Ho Chi Minh': 1698, 'Tay Ninh': 1698,
  'An Giang': 1757, 'Dong Thap': 1757, 'Vinh Long': 1757,
  'Can Tho': 1757, 'Ca Mau': 1757,
  'Gia Lai': 1850, 'Dak Lak': 1850, 'Lam Dong': 1850,
}

const PERIODS = [
  { id: 1, name: 'Bắc thuộc',                from: -99999, to: 937, bg: '#4a7c9e', fill: '#1e5c84' },
  { id: 2, name: 'Độc lập tự chủ',           from: 938,  to: 1427, bg: '#5a8f6e', fill: '#2e6b4a' },
  { id: 3, name: 'Đại Việt thịnh trị',       from: 1428, to: 1802, bg: '#7a6040', fill: '#8B0000' },
  { id: 4, name: 'Cận đại & Thực dân',       from: 1803, to: 1945, bg: '#6b5a7a', fill: '#4a3060' },
  { id: 5, name: 'Kháng chiến & Thống nhất', from: 1946, to: 1975, bg: '#7a4040', fill: '#8B2222' },
  { id: 6, name: 'Đổi mới & Hiện đại',       from: 1976, to: 2025, bg: '#3a6b6b', fill: '#1a4f4f' },
]

// ============================================================
// STATE
// ============================================================
let currentMode    = 'explore'
let selectedLayer  = null
let currentAudio   = null
let activeSpkBtn   = null

function speakSection(text, btn) {
  if (activeSpkBtn === btn && gTTSAudio) {
    stopGTTS()
    btn.innerHTML = SPEAKER_ICON
    btn.classList.remove('spk-playing')
    activeSpkBtn = null
    return
  }
  stopGTTS()
  if (activeSpkBtn) {
    activeSpkBtn.innerHTML = SPEAKER_ICON
    activeSpkBtn.classList.remove('spk-playing')
  }
  activeSpkBtn = btn
  btn.innerHTML = STOP_ICON
  btn.classList.add('spk-playing')
  gTTS(text, () => {
    btn.innerHTML = SPEAKER_ICON
    btn.classList.remove('spk-playing')
    if (activeSpkBtn === btn) activeSpkBtn = null
  })
}

// Explore province data
const provinceEvents = {}
const layerMap = {}
const viIndex  = {}
const viByEn   = {}

// Aggregated global event list (built after all provinces load)
let globalEvents    = []
let dataReady       = false
let loadedProvinces = 0
let totalProvinces  = 0

// Giai đoạn state
let gdFilter = 0
let gdQuery  = ''

// Journey state
let currentJourneyPeriod = 1
let journeyIndex   = 0
let journeyPlaying = false
let journeyTimer   = null
let journeySpeed   = 3000
let journeyMarker  = null

// Quiz state
let quizQuestions   = []
let quizIdx         = 0
let quizScore       = 0
let quizAnswering   = false
let quizMapActive   = false

// ============================================================
// HELPERS
// ============================================================
function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatYearStr(s) {
  return String(s)
    .replace(/\bsau\s+CN\b/gi, '')
    .replace(/\bSCN\b/g, '')
    .replace(/\btrước\s+CN\b/gi, 'TCN')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function parseYear(yearStr) {
  if (!yearStr) return null
  const s = String(yearStr)
  const m = s.match(/\d{3,4}/)
  if (!m) return null
  const n = parseInt(m[0])
  return /TCN|trước/i.test(s) ? -n : n
}

function getGiaiDoan(year) {
  if (year == null) return null
  for (const p of PERIODS) {
    if (year >= p.from && year <= p.to) return p.id
  }
  return null
}

function yearDisplay(n) {
  return n < 0 ? `${Math.abs(n)} TCN` : String(n)
}

// ============================================================
// DOM REFS
// ============================================================
const frame        = document.getElementById('frame')
const nameBarEl    = document.getElementById('nameBar')
const rightPanelEl = document.getElementById('rightPanel')
const emptyStateEl = document.getElementById('emptyState')
const outerFrameEl = document.getElementById('outerFrame')
const infoPanel    = document.getElementById('rightPanel')
const panelHeader  = document.getElementById('nameWithTTS')
const panelBody    = document.getElementById('panelBody')
const loader       = document.getElementById('loader')
const mapTooltip   = document.getElementById('mapTooltip')
const journeyYearEl = document.getElementById('journeyYearDisplay')

// ============================================================
// MAP
// ============================================================
const map = L.map('map', {
  zoomControl: false, scrollWheelZoom: false, doubleClickZoom: false,
  dragging: false, touchZoom: false, boxZoom: false, keyboard: false,
  renderer: L.svg(), zoomSnap: 0.001, zoomDelta: 0.01
}).setView([16, 106], 7)

const DEFAULT_STYLE = { fillOpacity: 1, weight: 1.2, color: '#7a3818' }

// glow filter for selected province
const glowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
glowSvg.setAttribute('style', 'position:absolute;width:0;height:0;')
glowSvg.innerHTML = `<defs><filter id="glow" x="-300%" y="-300%" width="600%" height="600%"><feGaussianBlur stdDeviation="6"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
document.body.appendChild(glowSvg)

function getName(f) {
  return (f.properties.adm1_name || '').replace(/\b(City|Province)\b/gi, '').trim()
}

function toSlug(name) {
  if (name === 'Ho Chi Minh') return 'ho_chi_minh_city'
  return name.toLowerCase().replace(/\s+/g, '_')
}

const PALETTE = [
  '#f5edd8','#f0c8c8','#dce8b8','#b8d8c4','#e0c898','#e8c0a8',
  '#b8d0e8','#c0b8d8','#f0e098','#c4d8b8','#f0d498','#f0b8a8',
  '#f0e0a8','#b0d4b8','#c8d4d8','#e8c4c0','#e4c8b0',
]
const colorMap = {}
let colorIndex = 0
function getColor(name) {
  if (!colorMap[name]) colorMap[name] = PALETTE[colorIndex++ % PALETTE.length]
  return colorMap[name]
}

function getPaths(layer) {
  if (layer._path) return [layer._path]
  const paths = []
  if (typeof layer.eachLayer === 'function') layer.eachLayer(l => paths.push(...getPaths(l)))
  return paths
}

function resetLayer(layer) {
  layer.setStyle({ ...DEFAULT_STYLE, fillColor: layer._defaultFill })
  if (layer._path) layer._path.style.filter = ''
}

// ============================================================
// MODE SYSTEM
// ============================================================
function switchMode(mode) {
  if (currentMode === mode) return

  // Clean up outgoing mode
  if (currentMode === 'journey') {
    pauseJourney()
    resetMapColors()
    journeyYearEl.classList.remove('visible')
    if (journeyMarker) { map.removeLayer(journeyMarker); journeyMarker = null }
    if ('speechSynthesis' in window) speechSynthesis.cancel()
  } else if (currentMode === 'gaido') {
    stopTTS()
    if (selectedLayer) { resetLayer(selectedLayer); selectedLayer = null }
  } else if (currentMode === 'quiz') {
    exitQuizMap()
  }

  currentMode = mode

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'))

  const ids = {
    home:    'homePanel',
    explore: 'explorePanel',
    gaido:   'gdPanel',
    journey: 'journeyPanel',
    quiz:    'newQuizPanel',
  }
  const target = document.getElementById(ids[mode])
  if (target) target.classList.add('active')

  if (mode === 'explore') {
    resetMapToExplore()
  } else if (mode === 'gaido') {
    resetMapColors()
    initGaiDoMode()
  } else if (mode === 'journey') {
    resetMapColors()
    initJourneyMode(currentJourneyPeriod)
  } else if (mode === 'quiz') {
    resetMapColors()
    initNewQuiz()
  } else {
    resetMapToHome()
  }
}

// ============================================================
// MAP COLOR HELPERS
// ============================================================
function applyHistoricalShading(yearNum, highlightEn, highlightFill) {
  Object.keys(layerMap).forEach(en => {
    if (highlightEn && en === highlightEn) {
      layerMap[en].setStyle({ fillColor: highlightFill, fillOpacity: 0.78, weight: 2.5, color: '#fff' })
      layerMap[en].bringToFront()
      return
    }
    const yearAdded = PROVINCE_YEAR[en] ?? -2879
    if (yearAdded <= yearNum) {
      layerMap[en].setStyle({ fillColor: '#c8b47a', fillOpacity: 0.42, weight: 1.2, color: '#7a3818' })
    } else {
      layerMap[en].setStyle({ fillColor: '#6a5a4a', fillOpacity: 0.16, weight: 1, color: '#4a3a2a' })
    }
  })
}

function resetMapColors() {
  if (selectedLayer) resetLayer(selectedLayer)
  Object.keys(layerMap).forEach(en => {
    if (layerMap[en] !== selectedLayer) resetLayer(layerMap[en])
  })
}

function resetMapToExplore() {
  frame.classList.remove('quiz-map-mode')
  journeyYearEl.classList.remove('visible')
  if (journeyMarker) { map.removeLayer(journeyMarker); journeyMarker = null }
}

function resetMapToHome() {
  resetMapColors()
  frame.classList.remove('quiz-map-mode')
  journeyYearEl.classList.remove('visible')
  if (journeyMarker) { map.removeLayer(journeyMarker); journeyMarker = null }
}

// ============================================================
// DATA AGGREGATION
// ============================================================
function buildGlobalEvents() {
  globalEvents = []
  Object.keys(provinceEvents).forEach(en => {
    const evs = provinceEvents[en]
    const tinh_name = viByEn[en] || en
    const layer = layerMap[en]
    const center = layer ? layer.getBounds().getCenter() : { lat: 16, lng: 106 }
    evs.forEach(ev => {
      const year_num = parseYear(ev.year)
      const giai_doan = getGiaiDoan(year_num)
      if (!year_num || !giai_doan) return
      globalEvents.push({
        en,
        tinh_name,
        year_num,
        year_str: formatYearStr(String(ev.year)).slice(0, 40),
        tieu_de: ev.summary || '',
        mo_ta: ev.detail || '',
        giai_doan,
        vi_tri: [center.lat, center.lng],
      })
    })
  })
  globalEvents.sort((a, b) => a.year_num - b.year_num)
  dataReady = true

  // If in a data-dependent mode, refresh it
  if (currentMode === 'journey')  initJourneyMode(currentJourneyPeriod)
  if (currentMode === 'gaido')    initGaiDoMode()
  if (currentMode === 'quiz')     initNewQuiz()
  // Auto-show Hà Nội once data is ready in explore mode
}

// ============================================================
// EXPLORE MODE
// ============================================================
function stopTTS() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  stopGTTS()
  if (activeSpkBtn) { activeSpkBtn.innerHTML = SPEAKER_ICON; activeSpkBtn.classList.remove('spk-playing'); activeSpkBtn = null }
}

function deselectProvince() {
  if (!selectedLayer) return
  stopTTS()
  resetLayer(selectedLayer)
  selectedLayer = null

  panelBody.style.opacity   = '0'
  panelBody.style.transform = 'translateY(6px)'
  setTimeout(() => {
    infoPanel.classList.remove('visible')
    panelHeader.classList.remove('visible')
    panelHeader.innerHTML = ''
    panelBody.innerHTML   = ''
    panelBody.style.opacity   = ''
    panelBody.style.transform = ''
    emptyStateEl.style.opacity   = '0'
    emptyStateEl.style.transform = 'translateY(8px)'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      emptyStateEl.style.opacity   = '1'
      emptyStateEl.style.transform = 'translateY(0)'
      setTimeout(() => { emptyStateEl.style.opacity = ''; emptyStateEl.style.transform = '' }, 260)
    }))
  }, 200)
}

function speakProvince(d) {
  const btn = document.getElementById('ttsBtn')
  if (!btn) return
  if (gTTSAudio) {
    stopGTTS()
    btn.innerHTML = SPEAKER_ICON
    btn.classList.remove('playing')
    return
  }
  const overview = d.sections?.find(s => s.label === 'Tổng Quan')
  const text = overview ? `${d.name}. ${overview.detail}` : d.name
  btn.classList.add('playing')
  btn.innerHTML = STOP_ICON
  gTTS(text, () => { btn.classList.remove('playing'); btn.innerHTML = SPEAKER_ICON })
}

function makeEntry(label, summary, detail, isYear) {
  const entry = document.createElement('div')
  entry.className = 'timeline-entry'

  const dot = document.createElement('div')
  dot.className = 'timeline-dot'

  const row = document.createElement('div')
  row.className = 'entry-toggle-row'

  const btn = document.createElement('button')
  btn.className = isYear ? 'timeline-year' : 'timeline-section'
  btn.textContent = label

  const spk = document.createElement('button')
  spk.className = 'section-spk'
  spk.title = 'Đọc sự kiện này'
  spk.innerHTML = SPEAKER_ICON
  const fullText = [summary, detail].filter(Boolean).join('. ')
  spk.addEventListener('click', e => { e.stopPropagation(); speakSection(fullText, spk) })

  row.appendChild(btn)
  row.appendChild(spk)

  const detailEl = document.createElement('div')
  detailEl.className = 'timeline-detail'
  const p = document.createElement('p')
  p.className = 'event-desc'
  p.textContent = detail
  detailEl.appendChild(p)

  btn.addEventListener('click', () => {
    const opening = !detailEl.classList.contains('open')
    detailEl.classList.toggle('open', opening)
    detailEl.style.maxHeight = opening ? detailEl.scrollHeight + 'px' : '0'
    btn.classList.toggle('active', opening)
  })

  entry.appendChild(dot)
  entry.appendChild(row)
  if (summary) {
    const pre = document.createElement('p')
    pre.className = 'timeline-preview'
    pre.textContent = summary
    entry.appendChild(pre)
  }
  entry.appendChild(detailEl)
  return entry
}

function buildTimeline(data) {
  const timeline = document.createElement('div')
  timeline.className = 'timeline'
  const frag = document.createDocumentFragment()

  // Merge all sections into one always-visible overview block
  const sections = data.sections || []
  if (sections.length > 0) {
    const overview = document.createElement('div')
    overview.className = 'province-overview'
    sections.forEach((s, i) => {
      if (i > 0) {
        const rule = document.createElement('div')
        rule.className = 'overview-rule'
        overview.appendChild(rule)
      }
      const p = document.createElement('p')
      p.className = 'overview-text'
      p.textContent = s.detail
      overview.appendChild(p)
    })
    frag.appendChild(overview)
  }

  // Events remain as expandable timeline entries
  let i = 0
  for (const ev of data.events || []) {
    const e = makeEntry(ev.year, ev.summary, ev.detail, true)
    e.style.animationDelay = `${i++ * 60}ms`
    frag.appendChild(e)
  }
  timeline.appendChild(frag)
  return timeline
}

function openProvince(en) {
  const layer = layerMap[en]
  if (!layer) return

  if (selectedLayer) resetLayer(selectedLayer)
  selectedLayer = layer
  layer.setStyle({ fillOpacity: 0.85, weight: 3, color: '#fff' })
  if (layer._path) layer._path.style.filter = 'url(#glow)'
  layer.bringToFront()

  const wasVisible = infoPanel.classList.contains('visible')
  if (wasVisible) {
    panelBody.style.opacity   = '0'
    panelBody.style.transform = 'translateY(-6px)'
  } else {
    emptyStateEl.style.opacity   = '0'
    emptyStateEl.style.transform = 'translateY(-6px)'
  }

  const fetchP = fetch(`provinces/${toSlug(en)}.json`).then(r => r.json())
  const waitP  = new Promise(r => setTimeout(r, 180))

  Promise.all([fetchP, waitP]).then(([d]) => {
    stopTTS()
    panelHeader.innerHTML = ''
    panelBody.innerHTML   = ''

    const h1 = document.createElement('h1')
    h1.textContent = d.name
    const ttsBtn = document.createElement('button')
    ttsBtn.id = 'ttsBtn'
    ttsBtn.innerHTML = SPEAKER_ICON
    ttsBtn.title = 'Đọc thuyết minh'
    ttsBtn.addEventListener('click', () => speakProvince(d))
    panelHeader.appendChild(h1)
    panelHeader.appendChild(ttsBtn)
    panelHeader.classList.add('visible')

    if (!wasVisible) {
      emptyStateEl.style.opacity   = ''
      emptyStateEl.style.transform = ''
    }

    panelBody.style.opacity   = '0'
    panelBody.style.transform = 'translateY(10px)'
    panelBody.appendChild(buildTimeline(d))
    infoPanel.classList.add('visible')
    panelBody.scrollTop = 0

    requestAnimationFrame(() => requestAnimationFrame(() => {
      panelBody.style.opacity   = '1'
      panelBody.style.transform = 'translateY(0)'
      setTimeout(() => { panelBody.style.opacity = ''; panelBody.style.transform = '' }, 260)
    }))
  }).catch(() => {})
}

// ============================================================
// GIAI ĐOẠN MODE
// ============================================================
function initGaiDoMode() {
  document.getElementById('gdDetail').classList.add('gd-hidden')
  document.getElementById('gdList').classList.remove('gd-hidden')
  selectedLayer = null
  applyGdShading()
  renderGdList()
}

function applyDensityShading(periodFilter) {
  const counts = {}
  globalEvents.forEach(ev => {
    if (periodFilter !== 0 && ev.giai_doan !== periodFilter) return
    counts[ev.en] = (counts[ev.en] || 0) + 1
  })
  const maxCount = Math.max(1, ...Object.values(counts))

  Object.keys(layerMap).forEach(en => {
    const count = counts[en] || 0
    if (count === 0) {
      resetLayer(layerMap[en])
    } else {
      const opacity = 0.25 + (count / maxCount) * 0.6
      layerMap[en].setStyle({ fillColor: '#c8b47a', fillOpacity: opacity, weight: 1.2, color: '#7a3818' })
    }
  })
}

function applyGdShading() {
  const legend = document.querySelector('.gd-density-legend')
  if (gdFilter === 0) {
    if (legend) legend.style.display = 'none'
    resetMapColors()
    return
  }
  if (legend) legend.style.display = 'flex'
  applyDensityShading(gdFilter)
}

function renderGdList() {
  const listEl = document.getElementById('gdList')
  const countEl = document.getElementById('gdCount')
  if (!dataReady) {
    listEl.innerHTML = '<p class="gd-loading">Đang tải dữ liệu...</p>'
    return
  }
  const q = gdQuery.toLowerCase()
  const evs = globalEvents.filter(e => {
    if (gdFilter !== 0 && e.giai_doan !== gdFilter) return false
    if (q && !e.tieu_de.toLowerCase().includes(q) &&
             !e.tinh_name.toLowerCase().includes(q) &&
             !e.year_str.toLowerCase().includes(q)) return false
    return true
  })
  countEl.textContent = evs.length + ' sự kiện'
  listEl.innerHTML = ''
  if (!evs.length) {
    listEl.innerHTML = '<p class="gd-loading">Không tìm thấy sự kiện nào</p>'
    return
  }
  const frag = document.createDocumentFragment()
  evs.forEach(ev => {
    const period = PERIODS[ev.giai_doan - 1]
    const item = document.createElement('div')
    item.className = 'gd-event-item'
    item.innerHTML = `
      <div class="gd-period-stripe" style="background:${period.fill}"></div>
      <div class="gd-event-main">
        <div class="gd-event-title">${ev.tieu_de}</div>
        <div class="gd-event-meta">
          <span class="gd-year-badge">${ev.year_str}</span>
          <span class="gd-province-tag">${ev.tinh_name}</span>
        </div>
      </div>
      <div class="gd-arrow">›</div>`
    item.addEventListener('click', () => openGdEvent(ev))
    item.addEventListener('mouseenter', () => {
      const p = PERIODS[ev.giai_doan - 1]
      applyHistoricalShading(ev.year_num, ev.en, p.fill)
    })
    frag.appendChild(item)
  })
  listEl.appendChild(frag)
  listEl.addEventListener('mouseleave', applyGdShading)
}

function openGdEvent(ev) {
  stopTTS()
  const period = PERIODS[ev.giai_doan - 1]

  applyHistoricalShading(ev.year_num, ev.en, period.fill)
  if (layerMap[ev.en]) {
    getPaths(layerMap[ev.en]).forEach(p => {
      p.classList.remove('tinh-pulse'); void p.offsetWidth; p.classList.add('tinh-pulse')
    })
    selectedLayer = layerMap[ev.en]
  }

  document.getElementById('gdDetailContent').innerHTML = `
    <div class="gd-detail-period" style="color:${period.fill}">${period.name}</div>
    <div class="gd-detail-year">${ev.year_str}</div>
    <h2 class="gd-detail-title">${ev.tieu_de}</h2>
    <div class="gd-detail-province">📍 ${ev.tinh_name}</div>
    ${ev.mo_ta ? `<p class="gd-detail-body">${ev.mo_ta}</p>` : ''}
    <button class="gd-tts-btn" id="gdTtsBtn">${SPEAKER_ICON}</button>`

  document.getElementById('gdBackBtn').onclick = closeGdEvent
  document.getElementById('gdTtsBtn').addEventListener('click', () => {
    const text = [ev.year_str, ev.tieu_de, ev.mo_ta].filter(Boolean).join('. ')
    speakSection(text, document.getElementById('gdTtsBtn'))
  })

  document.getElementById('gdList').classList.add('gd-hidden')
  document.getElementById('gdDetail').classList.remove('gd-hidden')
}

function closeGdEvent() {
  stopTTS()
  selectedLayer = null
  applyGdShading()
  document.getElementById('gdDetail').classList.add('gd-hidden')
  document.getElementById('gdList').classList.remove('gd-hidden')
}

// ============================================================
// TIMELINE MODE
// ============================================================
// ============================================================
// JOURNEY MODE
// ============================================================
function initJourneyMode(periodId) {
  currentJourneyPeriod = periodId
  journeyIndex = 0
  pauseJourney()

  document.querySelectorAll('#journeyPeriodBar .period-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.period) === periodId)
  })

  const playBtn = document.getElementById('btnJPlay')
  playBtn.textContent = '▶ Phát'
  playBtn.classList.remove('playing')

  if (!dataReady) {
    document.getElementById('journeyEventList').innerHTML =
      '<p style="color:rgba(240,232,224,0.3);padding:20px;text-align:center;font-size:12px">Đang tải dữ liệu...</p>'
    return
  }

  const evs = getJourneyEvents()

  const list = document.getElementById('journeyEventList')
  list.innerHTML = ''
  const frag = document.createDocumentFragment()
  evs.forEach((ev, i) => {
    const item = document.createElement('div')
    item.className = 'journey-event-item'
    item.style.animationDelay = `${Math.min(i * 22, 350)}ms`
    item.dataset.index = i
    const jperiod = PERIODS[currentJourneyPeriod - 1]
    item.innerHTML = `
      <div class="gd-period-stripe" style="background:${jperiod.fill}"></div>
      <div class="gd-event-main">
        <div class="gd-event-title">${ev.tieu_de}</div>
        <div class="gd-event-meta">
          <span class="gd-year-badge">${ev.year_str}</span>
          <span class="gd-province-tag">${ev.tinh_name}</span>
        </div>
      </div>
      <div class="gd-arrow">›</div>`
    item.addEventListener('click', () => { pauseJourney(); jumpJourneyTo(i) })
    frag.appendChild(item)
  })
  list.appendChild(frag)

  updateJourneyProgress(evs)
  journeyYearEl.classList.add('visible')
  journeyYearEl.textContent = evs[0] ? evs[0].year_str : ''

  // Shade map to show territory at start of this period
  const periodDef = PERIODS[currentJourneyPeriod - 1]
  const baseYear = evs[0] ? evs[0].year_num : (periodDef.from === -99999 ? -2879 : periodDef.from)
  applyHistoricalShading(baseYear)
}

function getJourneyEvents() {
  return globalEvents.filter(e => e.giai_doan === currentJourneyPeriod)
}

function playJourney() {
  if (journeyPlaying) return
  journeyPlaying = true
  const btn = document.getElementById('btnJPlay')
  btn.textContent = '⏸ Dừng'
  btn.classList.add('playing')

  const evs = getJourneyEvents()
  if (journeyIndex >= evs.length) journeyIndex = 0

  function advance() {
    if (!journeyPlaying) return
    journeyIndex++
    const curEvs = getJourneyEvents()
    if (journeyIndex >= curEvs.length) {
      if (currentJourneyPeriod < PERIODS.length) {
        initJourneyMode(currentJourneyPeriod + 1)
        playJourney()
      } else {
        pauseJourney()
      }
      return
    }
    playJourneyStep(journeyIndex, advance)
  }

  playJourneyStep(journeyIndex, advance)
}

function pauseJourney() {
  if (!journeyPlaying) return
  journeyPlaying = false
  if (journeyTimer) { clearTimeout(journeyTimer); journeyTimer = null }
  stopGTTS()
  const btn = document.getElementById('btnJPlay')
  if (btn) { btn.textContent = '▶ Phát'; btn.classList.remove('playing') }
}

function jumpJourneyTo(idx) {
  const evs = getJourneyEvents()
  journeyIndex = Math.max(0, Math.min(idx, evs.length - 1))
  playJourneyStep(journeyIndex)
  updateJourneyProgress(evs)
}

function playJourneyStep(idx, onNext) {
  const evs = getJourneyEvents()
  if (!evs[idx]) return
  const ev = evs[idx]
  const period = PERIODS[currentJourneyPeriod - 1]

  applyHistoricalShading(ev.year_num, ev.en, period.fill)
  if (layerMap[ev.en]) {
    getPaths(layerMap[ev.en]).forEach(p => {
      p.classList.remove('tinh-pulse')
      void p.offsetWidth
      p.classList.add('tinh-pulse')
    })
  }

  // Year overlay with pulse
  journeyYearEl.textContent = ev.year_str
  journeyYearEl.classList.add('visible')
  journeyYearEl.classList.remove('year-pulse')
  void journeyYearEl.offsetWidth
  journeyYearEl.classList.add('year-pulse')

  // Event marker
  if (journeyMarker) map.removeLayer(journeyMarker)
  const icon = L.divIcon({
    className: 'journey-event-marker',
    html: `<div class="jem-inner"><span class="jem-year">${ev.year_str}</span><span class="jem-title">${ev.tieu_de.slice(0, 55)}</span><div class="jem-province">${ev.tinh_name}</div></div>`,
    iconSize:   [0, 0],
    iconAnchor: [0, 0],
  })
  journeyMarker = L.marker(ev.vi_tri, { icon, interactive: false }).addTo(map)

  // Update list UI
  document.querySelectorAll('.journey-event-item').forEach((item, i) => {
    item.classList.toggle('active', i === idx)
    item.classList.toggle('played', i < idx)
  })
  const activeItem = document.querySelector('.journey-event-item.active')
  if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

  // Narrate; drive auto-play timing from TTS completion
  const narration = [ev.year_str, ev.tieu_de].filter(Boolean).join('. ')
  if (onNext) {
    gTTS(narration, () => { if (journeyPlaying) journeyTimer = setTimeout(onNext, 600) })
  } else {
    gTTS(narration)
  }

  updateJourneyProgress(evs)
}

function updateJourneyProgress(evs) {
  const pct = evs.length > 1 ? (journeyIndex / (evs.length - 1)) * 100 : 0
  document.getElementById('journeyProgressFill').style.width = pct + '%'
}

// ============================================================
// QUIZ MODE (3 types: click-map / choose-year / choose-event)
// ============================================================
let newQuizActive = false

function initNewQuiz() {
  if (!dataReady) {
    document.getElementById('qQuestion').textContent = 'Đang tải dữ liệu...'
    return
  }

  const eligible = globalEvents.filter(e => e.tieu_de && e.tieu_de.length > 12)
  if (eligible.length < 10) {
    document.getElementById('qQuestion').textContent = 'Không đủ dữ liệu để tạo câu hỏi.'
    return
  }

  quizQuestions = generateQuizQuestions(eligible, 10)
  quizIdx       = 0
  quizScore     = 0
  quizAnswering = false
  newQuizActive = true

  document.getElementById('qResult').classList.add('hidden')
  const qBody = document.getElementById('qBody')
  qBody.style.display = 'flex'
  document.getElementById('qScore').textContent = '0 điểm'

  renderQuizQuestion()
}

function generateQuizQuestions(eligible, n) {
  const pool = shuffleArray(eligible).slice(0, n)
  return pool.map((ev, i) => ({ type: i % 3, ev }))
}

function renderQuizQuestion() {
  if (quizIdx >= quizQuestions.length) { showQuizResult(); return }

  const { type, ev } = quizQuestions[quizIdx]
  quizAnswering = false
  quizMapActive = false

  document.getElementById('qProgress').textContent = `Câu ${quizIdx + 1} / ${quizQuestions.length}`
  document.getElementById('qProgFill').style.width = `${(quizIdx / quizQuestions.length) * 100}%`

  const typeTags = ['Click bản đồ', 'Chọn năm', 'Chọn sự kiện']
  document.getElementById('qTypeTag').textContent = typeTags[type]
  document.getElementById('qFeedback').textContent = ''
  document.getElementById('qFeedback').className  = ''

  const qEl   = document.getElementById('qQuestion')
  const hEl   = document.getElementById('qHint')
  const optEl = document.getElementById('qOptions')
  optEl.innerHTML = ''

  if (type === 0) {
    qEl.textContent = `Sự kiện "${ev.tieu_de}" xảy ra ở tỉnh/thành phố nào? Hãy click vào bản đồ!`
    hEl.textContent = '□ Nhấn trực tiếp vào vùng tỉnh thành trên bản đồ bên trái để trả lời'
    frame.classList.add('quiz-map-mode')
    quizMapActive = true

  } else if (type === 1) {
    qEl.textContent = `Sự kiện "${ev.tieu_de}" xảy ra vào năm nào?`
    hEl.textContent = ''
    frame.classList.remove('quiz-map-mode')

    const correctStr = yearDisplay(ev.year_num)
    const distractors = getYearDistractors(ev.year_num, ev.giai_doan, 3)
    shuffleArray([ev.year_num, ...distractors]).forEach(yr => {
      const s = yearDisplay(yr)
      const btn = document.createElement('button')
      btn.className = 'quiz-opt'
      btn.textContent = s
      btn.addEventListener('click', () => submitQuizOpt(s, correctStr, btn))
      optEl.appendChild(btn)
    })

  } else {
    qEl.textContent = `Tại ${ev.tinh_name}, vào năm ${ev.year_str}, sự kiện gì đã diễn ra?`
    hEl.textContent = ''
    frame.classList.remove('quiz-map-mode')

    const distractors = getEventDistractors(ev, 3)
    shuffleArray([ev, ...distractors]).forEach(opt => {
      const btn = document.createElement('button')
      btn.className = 'quiz-opt'
      btn.textContent = opt.tieu_de
      btn.addEventListener('click', () => submitQuizOpt(opt.tieu_de, ev.tieu_de, btn))
      optEl.appendChild(btn)
    })
  }
}

function getYearDistractors(correctYear, giai_doan, n) {
  const pool = [...new Set(
    globalEvents
      .filter(e => e.giai_doan === giai_doan && e.year_num !== correctYear)
      .map(e => e.year_num)
  )]
  return shuffleArray(pool).slice(0, n)
}

function getEventDistractors(ev, n) {
  const pool = globalEvents.filter(e => !(e.en === ev.en && e.year_num === ev.year_num))
  return shuffleArray(pool).slice(0, n)
}

function submitQuizMapAnswer(clickedEn) {
  if (!newQuizActive || quizAnswering || !quizMapActive) return
  quizAnswering = true
  quizMapActive = false  // prevent further clicks while keeping quiz-map-mode class for CSS

  const { ev } = quizQuestions[quizIdx]
  const isCorrect = clickedEn === ev.en

  const correctPaths = getPaths(layerMap[ev.en] || {})
  correctPaths.forEach(p => p.classList.add('q-correct'))
  if (!isCorrect && layerMap[clickedEn]) {
    getPaths(layerMap[clickedEn]).forEach(p => p.classList.add('q-wrong'))
  }

  showFeedback(isCorrect)
  setTimeout(() => {
    correctPaths.forEach(p => p.classList.remove('q-correct'))
    if (layerMap[clickedEn]) getPaths(layerMap[clickedEn]).forEach(p => p.classList.remove('q-wrong'))
    frame.classList.remove('quiz-map-mode')
    quizIdx++
    renderQuizQuestion()
  }, isCorrect ? 1500 : 2000)
}

function submitQuizOpt(answer, correct, clickedBtn) {
  if (!newQuizActive || quizAnswering) return
  quizAnswering = true

  const isCorrect = answer === correct
  document.querySelectorAll('.quiz-opt').forEach(btn => {
    btn.disabled = true
    if (btn === clickedBtn) {
      btn.classList.add(isCorrect ? 'correct' : 'wrong')
    } else if (btn.textContent === correct) {
      btn.classList.add('correct')
    }
  })

  showFeedback(isCorrect)
  setTimeout(() => { quizIdx++; renderQuizQuestion() }, isCorrect ? 1500 : 2000)
}

function showFeedback(isCorrect) {
  const fb = document.getElementById('qFeedback')
  if (isCorrect) {
    quizScore += 10
    const scoreEl = document.getElementById('qScore')
    scoreEl.textContent = `${quizScore} điểm`
    // spring pop on score
    scoreEl.classList.remove('popping')
    void scoreEl.offsetWidth
    scoreEl.classList.add('popping')
    scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('popping'), { once: true })
    // floating +10
    const rect = scoreEl.getBoundingClientRect()
    const floater = document.createElement('div')
    floater.className = 'score-float'
    floater.textContent = '+10'
    floater.style.left = `${rect.left + rect.width / 2 - 20}px`
    floater.style.top  = `${rect.top}px`
    document.body.appendChild(floater)
    floater.addEventListener('animationend', () => floater.remove())
    fb.textContent = '✓ ĐÚNG RỒI!'
    fb.className = 'correct'
  } else {
    fb.textContent = '✗ SAI RỒI!'
    fb.className = 'wrong'
  }
}

function showQuizResult() {
  newQuizActive = false
  exitQuizMap()

  document.getElementById('qBody').style.display = 'none'
  const resultEl = document.getElementById('qResult')
  resultEl.classList.remove('hidden')

  const total   = quizQuestions.length
  const correct = quizScore / 10

  document.getElementById('qrScore').textContent = `${quizScore}/100`
  document.getElementById('qrStats').textContent = `${correct} câu đúng · ${total - correct} câu sai`
  document.getElementById('qProgFill').style.width = '100%'

  let grade
  if      (quizScore >= 90) grade = '🏆 Xuất sắc — Nhà sử học tương lai!'
  else if (quizScore >= 70) grade = '⭐ Giỏi — Hiểu biết lịch sử rất tốt!'
  else if (quizScore >= 50) grade = '📚 Khá — Cần ôn thêm một số giai đoạn.'
  else                       grade = '💪 Cố gắng — Hãy xem lại Hành trình lịch sử nhé!'
  document.getElementById('qrGrade').textContent = grade
}

function exitQuizMap() {
  quizMapActive = false
  frame.classList.remove('quiz-map-mode')
}

// ============================================================
// EASTER EGG
// ============================================================
const easterEggEl = document.getElementById('easterEgg')
const searchBox     = document.getElementById('searchBox')
const searchResults = document.getElementById('searchResults')

function triggerEasterEgg() {
  searchBox.value = ''
  searchResults.classList.remove('open')
  easterEggEl.setAttribute('aria-hidden', 'false')
  easterEggEl.classList.add('active')
  frame.classList.add('easter-pulse')
  setTimeout(() => frame.classList.remove('easter-pulse'), 2100)
}
function closeEasterEgg() {
  easterEggEl.classList.remove('active')
  easterEggEl.setAttribute('aria-hidden', 'true')
}
document.getElementById('easterEggClose').addEventListener('click', closeEasterEgg)
easterEggEl.addEventListener('click', e => { if (e.target === easterEggEl) closeEasterEgg() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeEasterEgg() })

// ============================================================
// SEARCH
// ============================================================
const EE_TRIGGERS = new Set(['hùng vương', 'hung vuong'])

searchBox.addEventListener('input', () => {
  const q = searchBox.value.trim().toLowerCase()
  searchResults.innerHTML = ''
  if (!q) { searchResults.classList.remove('open'); return }
  if (EE_TRIGGERS.has(q)) { triggerEasterEgg(); return }

  const seen = new Set()
  const matches = []
  Object.keys(viIndex).forEach(key => {
    if (key.includes(q)) {
      const { en, display } = viIndex[key]
      if (!seen.has(en)) { seen.add(en); matches.push({ label: display, en }) }
    }
  })
  Object.keys(layerMap).forEach(en => {
    if (en.toLowerCase().includes(q) && !seen.has(en)) {
      seen.add(en); matches.push({ label: en, en })
    }
  })
  if (!matches.length) { searchResults.classList.remove('open'); return }

  matches.slice(0, 8).forEach(({ label, en }) => {
    const item = document.createElement('div')
    item.className = 'search-item'
    item.textContent = label
    item.addEventListener('mousedown', e => {
      e.preventDefault()
      if (currentMode !== 'explore') switchMode('explore')
      setTimeout(() => openProvince(en), currentMode !== 'explore' ? 150 : 0)
      searchBox.value = ''
      searchResults.classList.remove('open')
    })
    searchResults.appendChild(item)
  })
  searchResults.classList.add('open')
})

searchBox.addEventListener('blur', () => {
  setTimeout(() => searchResults.classList.remove('open'), 150)
})

// ============================================================
// GEOJSON + PROVINCE LOADING
// ============================================================
function primeProvinces(provinces) {
  provinces.eachLayer(layer => {
    getPaths(layer).forEach(path => path.classList.add('anim-hidden'))
  })
}

function drawProvinces(provinces, islandLayer) {
  const layers = []
  provinces.eachLayer(l => layers.push(l))
  layers.sort((a, b) => b.getBounds().getCenter().lat - a.getBounds().getCenter().lat)

  layers.forEach((layer, i) => {
    getPaths(layer).forEach(path => {
      setTimeout(() => {
        const len = path.getTotalLength()
        path.style.strokeDasharray  = len
        path.style.strokeDashoffset = len
        path.style.fillOpacity = '0'
        path.classList.remove('anim-hidden')
        requestAnimationFrame(() => {
          path.style.transition =
            'stroke-dashoffset 0.65s cubic-bezier(0.4,0,0.2,1), fill-opacity 0.5s ease 0.45s'
          path.style.strokeDashoffset = '0'
          path.style.fillOpacity = '1'
        })
      }, i * 38)
    })
  })

  if (!islandLayer) return
  setTimeout(() => {
    islandLayer.eachLayer(l => getPaths(l).forEach(p => p.classList.add('island-draw')))
    setTimeout(() => islandLayer.setStyle({ opacity: 0.85 }), 750)
  }, layers.length * 38 + 350)
}

function addIslandOverlay(data) {
  const features = []
  data.features.forEach(feat => {
    const geom = feat.geometry
    if (geom.type !== 'MultiPolygon') return
    geom.coordinates.forEach(polyCoords => {
      const ring = polyCoords[0]
      let minLon = Infinity
      for (let j = 0; j < ring.length; j++) if (ring[j][0] < minLon) minLon = ring[j][0]
      if (minLon > 109.6) {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: polyCoords }, properties: {} })
      }
    })
  })
  if (!features.length) return null
  return L.geoJSON({ type: 'FeatureCollection', features }, {
    style: { color: '#f0ddb8', weight: 1.8, opacity: 0, fill: false, interactive: false }
  }).addTo(map)
}

fetch('vietnam-provinces.geojson')
  .then(r => r.json())
  .then(data => {
    const provinces = L.geoJSON(data, {
      style: f => ({ color: '#7a3818', weight: 1.2, fillColor: getColor(getName(f)), fillOpacity: 1 }),
      onEachFeature(feature, layer) {
        const en = getName(feature)
        layerMap[en] = layer
        layer._defaultFill = getColor(en)

        layer.on('mouseover', () => {
          if (currentMode !== 'explore' && !quizMapActive) {
            mapTooltip.textContent = viByEn[en] || en
            mapTooltip.classList.add('visible')
            return
          }
          if (quizMapActive) return
          if (layer !== selectedLayer) {
            layer.setStyle({ fillOpacity: 0.85, weight: 3, color: '#fff' })
            layer.bringToFront()
          }
          mapTooltip.textContent = viByEn[en] || en
          mapTooltip.classList.add('visible')
        })

        layer.on('mouseout', () => {
          mapTooltip.classList.remove('visible')
          if (currentMode !== 'explore' || quizMapActive) return
          if (layer !== selectedLayer) {
            layer.setStyle({ ...DEFAULT_STYLE, fillColor: layer._defaultFill })
            if (selectedLayer) selectedLayer.bringToFront()
          }
        })

        layer.on('click', () => {
          if (quizMapActive) { submitQuizMapAnswer(en); return }
          if (currentMode !== 'explore') return
          openProvince(en)
        })
      }
    }).addTo(map)

    const islandLayer = addIslandOverlay(data)

    requestAnimationFrame(() => {
      map.invalidateSize()
      map.fitBounds(provinces.getBounds(), { padding: [20, 20] })
      setTimeout(() => {
        map.setZoom(map.getZoom() + 0.002)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          primeProvinces(provinces)
          if (loader) loader.classList.add('hidden')
          setTimeout(() => drawProvinces(provinces, islandLayer), 600)
        }))
      }, 80)
    })

    // Preload all province data for search + modes
    totalProvinces = Object.keys(layerMap).length
    setTimeout(() => {
      Object.keys(layerMap).forEach(en => {
        fetch(`provinces/${toSlug(en)}.json`)
          .then(r => r.json())
          .then(d => {
            const key = d.name.toLowerCase()
            viIndex[key] = { en, display: d.name }
            viByEn[en] = d.name
            provinceEvents[en] = d.events || []
            loadedProvinces++
            if (loadedProvinces >= totalProvinces) buildGlobalEvents()
          })
          .catch(() => { loadedProvinces++; if (loadedProvinces >= totalProvinces) buildGlobalEvents() })
      })
    }, 600)
  })

// ============================================================
// CLICK OUTSIDE (deselect in explore mode)
// ============================================================
outerFrameEl.addEventListener('click', e => {
  if (currentMode !== 'explore') return
  if (!e.target.closest('#frame') && !e.target.closest('#textWrapper')) deselectProvince()
})

frame.addEventListener('mousemove', e => {
  const rect = outerFrameEl.getBoundingClientRect()
  mapTooltip.style.left = (e.clientX - rect.left) + 'px'
  mapTooltip.style.top  = (e.clientY - rect.top)  + 'px'
})

window.addEventListener('load',   () => map.invalidateSize())
window.addEventListener('resize', () => map.invalidateSize())


// ============================================================
// EVENT LISTENERS FOR NEW MODES
// ============================================================

// Mode bar
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode))
})

// Giai đoạn filters + search
document.querySelectorAll('.gd-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gd-filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    gdFilter = parseInt(btn.dataset.period)
    initGaiDoMode()
  })
})
document.getElementById('gdSearchBox').addEventListener('input', e => {
  gdQuery = e.target.value
  initGaiDoMode()
})

// Journey periods
document.querySelectorAll('#journeyPeriodBar .period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    pauseJourney()
    currentJourneyPeriod = parseInt(btn.dataset.period)
    initJourneyMode(currentJourneyPeriod)
  })
})

// Journey controls
document.getElementById('btnJFirst').addEventListener('click', () => { pauseJourney(); jumpJourneyTo(0) })
document.getElementById('btnJPrev').addEventListener('click',  () => { pauseJourney(); jumpJourneyTo(journeyIndex - 1) })
document.getElementById('btnJPlay').addEventListener('click',  () => { if (journeyPlaying) pauseJourney(); else playJourney() })
document.getElementById('btnJNext').addEventListener('click',  () => { pauseJourney(); jumpJourneyTo(journeyIndex + 1) })
document.getElementById('btnJLast').addEventListener('click',  () => { pauseJourney(); jumpJourneyTo(getJourneyEvents().length - 1) })

document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    journeySpeed = parseInt(btn.dataset.speed)
    if (journeyPlaying) { pauseJourney(); playJourney() }
  })
})

// Quiz
document.getElementById('quizStartBtn').addEventListener('click', () => switchMode('quiz'))
document.getElementById('qrRestart').addEventListener('click', initNewQuiz)
document.getElementById('qrExit').addEventListener('click', () => switchMode('home'))
