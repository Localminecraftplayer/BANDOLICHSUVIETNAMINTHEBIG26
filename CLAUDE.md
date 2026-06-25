# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

The app requires a local Python proxy server to work (TTS and static file serving):

```bash
cd sigseven
python3 server.py
```

Then open `http://localhost:8080` in a browser. **Do not use `python3 -m http.server`** — TTS will not work without `server.py`.

## Architecture

This is a single-page vanilla JS/CSS/HTML app with no build step. All logic lives in `script.js` (~1000+ lines), styled by `style.css`, and loaded via `index.html`.

### The five modes

The app has five modes controlled by `switchMode(mode)`:
- `home` — static welcome poem
- `explore` — click provinces on map to see history
- `gaido` — browse all historical events by period filter
- `journey` — auto-play events period by period with TTS narration
- `quiz` — three question types: click map / choose year / choose event

Mode transitions clean up the previous mode (stop TTS, reset map, etc.) then call the corresponding `init*Mode()` function.

### Data flow

Province JSON files in `provinces/` are loaded dynamically at startup (one `fetch` per province). Each file contains `{ name, sections: [{ label, summary, detail, year }] }`. After all provinces load, `buildGlobalEvents()` assembles a flat `globalEvents[]` array sorted by `year_num` — this feeds both journey and giai đoạn modes.

Key lookups:
- `layerMap[englishName]` → Leaflet layer for that province
- `viByEn[englishName]` → Vietnamese province name
- `provinceEvents[englishName]` → raw event array from province JSON
- `globalEvents[]` → flat sorted event objects `{ en, tinh_name, year_num, year_str, tieu_de, mo_ta, giai_doan, vi_tri }`

### Historical map shading

`PROVINCE_YEAR` maps each English province name to the year it came under Vietnamese control. Two functions control map color:

- `applyHistoricalShading(yearNum)` — shades in-territory provinces gold (`#c8b47a`) and out-of-territory grey (`#6a5a4a`) based on `PROVINCE_YEAR[en] <= yearNum`
- `resetMapColors()` — restores palette colors from `layer._defaultFill`
- `applyGdShading()` — calls one of the above based on current `gdFilter`

Historical shading is applied whenever entering journey/giai đoạn mode and when individual events are opened.

### PERIODS array

```js
const PERIODS = [
  { id: 1, name: 'Bắc thuộc',                from: -99999, to: 937,  bg, fill },
  { id: 2, name: 'Độc lập tự chủ',           from: 938,   to: 1427, bg, fill },
  { id: 3, name: 'Đại Việt thịnh trị',       from: 1428,  to: 1802, bg, fill },
  { id: 4, name: 'Cận đại & Thực dân',       from: 1803,  to: 1945, bg, fill },
  { id: 5, name: 'Kháng chiến & Thống nhất', from: 1946,  to: 1975, bg, fill },
  { id: 6, name: 'Đổi mới & Hiện đại',       from: 1976,  to: 2025, bg, fill },
]
```

Period IDs are 1-indexed and match `giai_doan` values on event objects and `data-period` attributes on buttons.

### TTS pipeline

`gTTS(text, onEnd)` is the primary TTS function:
1. Calls `expandForTTS(text)` to expand acronyms (TCN → Trước Công Nguyên, etc.)
2. Splits into 500-char chunks via `chunkText()`
3. Fetches `/tts?q=<chunk>` from `server.py` (which proxies FPT AI)
4. Falls back to `speakWebSpeech()` (Web Speech API) if the first chunk fails

`server.py` caches responses as MP3 files in `.tts_cache/` (MD5-keyed). FPT AI returns an `async` URL that takes up to ~12 seconds to become ready — the server polls it 15 times × 0.8s.

FPT AI config in `server.py`:
- `FPT_KEY` — API key
- `FPT_VOICE` — voice name (e.g. `minhquang`, `banmai`)

TTS is enabled in FPT AI dashboard at fpt.ai — if TTS returns 500, check the dashboard first.

### CSS border-radius scale

Consistent values used throughout: `44px` (outerFrame), `28px` (panels), `20px` (buttons/inputs), `10px` (chips), `4px` (bars), `50%` (circles). Don't introduce other radius values.

### Province GeoJSON

`vietnam-provinces.geojson` is the base map. Individual province data files in `provinces/` use the English name from `adm1_name` (with "City"/"Province" stripped) as the key — e.g. `Ho Chi Minh`, `Ha Noi`. The slug `ho_chi_minh_city` is a special case in `toSlug()`.

### Giai đoạn state

- `gdFilter` (0–6) — active period filter; 0 = all periods
- `gdQuery` — search string from `#gdSearchBox`
- `renderGdList()` filters `globalEvents` by both and renders the list
- `openGdEvent(ev)` — shows event detail + applies exact historical shading for `ev.year_num`
- `closeGdEvent()` — returns to list + restores period shading via `applyGdShading()`
