# Elevation Feature Preview – v1.1.0.4 (layout / unit refinement)

## Scope

An experimental, independent elevation feature adds:
- Total ascent and descent (+m/−m, or +ft/−ft when miles are selected) together in one results tile.
- An interactive elevation chart immediately beneath the route map. Select a location by tapping or dragging the chart; keyboard users can focus the chart and use Arrow keys, Page Up/Down, Home and End.
- A selected-point readout of **height difference from route start** (not altitude above sea level). The chart's vertical axis displays absolute altitude in meters or feet according to the unit selection; horizontal distance switches between kilometers and miles.
- German, English and Spanish labels; light and dark styling; graceful unavailable-data message.

## Changes from v1.1.0.3 to v1.1.0.4

- The chart (including relative change and position readouts) appears immediately beneath the map; individual enclosed-area details continue below the statistics.
- A single ascent/descent tile appears in the statistics grid after circle efficiency and before square efficiency, directly below Area Factor. The original five-card layout remains when GPX elevations are missing.
- The estimate-info button is visually reduced from 28 px to 18 px, with an additional invisible pointer target, and the disclosure is now a popup anchored to the combined metric tile.
- Switching to miles also switches **all elevation output** to feet: ascent, descent, relative elevation, absolute chart ticks, vertical-axis unit and screen-reader value text. Internal data and calculations remain in meters.
- No changes to geometry, Area Factor, vertical gain/loss algorithms, or chart pointer handling.

## Changes from v1.1.0.2 to v1.1.0.3

- Reordered results so that individual enclosed-area details appear beneath the elevation section.
- Removed the elevation card's outer border, inset padding and redundant heading, allowing the plotted SVG to occupy the same full content width as the route map.
- Halved the chart's internal SVG viewBox height (mobile: 230 → 115 units, desktop: 255 → 128 units). Kept the existing interactive guide/marker and axis ticks, adjusting plot margins.
- Replaced the always-visible estimate note with an info button alongside the ascent label. Tap/click to reveal it, tap elsewhere or press Escape to dismiss. Accessible labels in DE/EN/ES and dark-mode styles are included.
- No changes to GPX algorithms, route map handling, worker code, Area Factor, or touch-gesture event handlers.

## Changes from v1.1.0.1 to v1.1.0.2

- The plotted SVG region now captures touch, mouse and pen pointers for stable dragging in either direction (and releases them when the gesture ends).
- Touch scrolling inside the SVG diagram is deliberately disabled to prevent Android from cancelling a drag. Vertical page scrolling still works outside the chart, including the surrounding metrics and content.
- App-level left/right swipes no longer trigger a calculation-view change if a gesture starts anywhere inside the elevation section. Swipe navigation elsewhere remains available.
- Removed the visually redundant range input; preserved screen-reader and keyboard selection directly on the focusable SVG chart (accessible horizontal slider role).
- No change to smoothing, GPX parsing, area/efficiency values, CSV output, or maps.

## Method used in this preview

The feature reads `<ele>` elements from the same GPX track/route points already used for the route. A chart is shown **only when every point has a valid elevation**, avoiding misleading 0 m results. It calculates cumulative horizontal track distance (Haversine); each track segment is handled separately, without counting a height jump across recording gaps. Within each segment:

1. Interpolate elevation onto a **20 m distance grid**.
2. Smooth the grid with a **Gaussian kernel, σ = 40 m**, truncated at ±3σ.
3. Sum positive differences as ascent and negative differences as descent. Display rounded whole meters, with descent shown as a negative number.
4. Display height difference relative to the **smoothed starting height**, so the diagram and readout agree. A constant absolute height offset does not affect this difference.

**These are estimated vertical gains/losses, not independently verified true ascent/descent.** This method is a test candidate and may under-count short sharp climbs or over-count noisy recordings. Komoot and Samsung Health may use proprietary elevation-correction algorithms or additional terrain data that are not available in the exported GPX file. The algorithm is intentionally not fitted to make any one reference route match.

## Reference routes (provided by project owner)

| GPX | App reference ascent / descent | Initial preview ascent / descent (rounded) |
| --- | --- | --- |
| `Kreis_von_M_dling.gpx` (Komoot planned) | +370 m / −370 m | +344 m / −349 m |
| `20251203_155657.gpx` (Samsung Health recorded) | +371 m / descent unknown | +371 m / −377 m |
| `2026-11-16_3396719480_Test 10HM - komoot.gpx` (flat planned) | +10 m / −10 m | +11 m / −11 m |

These three routes are only preliminary sanity tests and cannot establish universal accuracy. Further validation should include other steep, flat and noisy tracks and routes with missing or partial elevation data.

## Safety / integration

- Existing `readGpx()`, `evaluate()`, `geometry-worker.js`, area calculation, Area Factor, comparison, route rendering and existing CSV layout remain unchanged. The worker URL has only been cache-busted; its source remains identical to v1.1.0.1.
- Elevation calculations are in new `elevation.js`, attached to each successful result after the geometry calculation. Elevation parse failures do not invalidate a route's area analysis.
- Chart drawing is native SVG, with no external dependencies or network requests.
- Service worker cache and asset names updated so the new script and unchanged geometry worker can work offline after initial loading.
- Chart-selection-to-map-position synchronization is **not** included in this preview; reserved for a future revision.
- Do not upload a test build to the public GitHub Pages site as stable before checking real iOS, Android, desktop and offline behavior.

## v1.1.0.2 verification scope

Automated Chromium browser checks covered Android-touch and iPhone-like device emulation: forward/reverse dragging (also with vertical finger drift), chart pointer capture, no unwanted mode switch, normal page-swipe navigation outside the chart, desktop mouse dragging, keyboard controls, km/mi, Spanish, dark mode, and no JavaScript errors. Comparing the three reference GPX files against v1.1.0.1 confirmed exactly unchanged ascent/descent results.

**Limitations:** The tests did **not** run on real Android devices, iOS Safari/WebKit, a live service worker/offline installation, or the deployed Web Worker. In-browser test navigation was restricted; tests loaded the real JS inline and used the pre-existing main-thread geometry fallback. Please test on both physical smartphones before considering this revision stable.

## v1.1.0.4 verification scope

- Automated desktop Chromium and Android/iPhone-like touch emulations at 320, 390, 768 and 1280 CSS pixels checked map/chart alignment, chart-before-stat ordering, the middle summary tile below Area Factor, no horizontal overflow, info-button behavior, and chart dragging left and right.
- Metric and imperial labels were checked for total ascent, descent, relative height, absolute height tick labels and chart axis units, including accessible selected-point text. The height conversion is 1 m = 3.280839895013123 ft, rounded to whole display units. Internal track heights and height-gain computations remain in metres.
- German, English and Spanish languages and dark theme passed UI checks. Two imported routes have independently dismissible info notes. Missing `<ele>` GPX tracks retain the original five-stat layout.
- References: flat Komoot +11/−11 m, hilly Komoot +344/−349 m, Samsung +371/−377 m; identical to the previous preview. The geometry worker is byte-identical to v1.1.0.3. Mouse and keyboard interaction also passed.
- Real-device iOS Safari, Android browsers, installed-PWA updates and offline caching remain to be confirmed by the project owner.

## v1.1.0.3 verification scope

Automated Chromium checks (not physical-device tests) covered Android-like and iOS-like touch gestures at 390 px, a narrow 320 px viewport, a 768 px tablet, and a 1280 px desktop. All chart widths matched the route-map container (within 2 px tolerance), the reduced SVG height and new result order were confirmed, and no body overflow or JavaScript errors occurred. Mouse/keyboard selection, DE/EN/ES info text and labels, dark-mode button styling, km/mi, and enclosed-area table switching passed. Both swipe directions remained functional. A separate multiple-route test verified independent info buttons and dismissal behavior, and a GPX without elevation returned an unavailable-data state. Total ascent/descent and displayed distance were unchanged relative to v1.1.0.2 for all three reference GPX files.

**Not yet verified:** Physical Android/iOS Safari behavior, a deployed offline/PWA service worker, production Web Worker operation, and wider routes/real-device combinations. Keep as test build until field checks are satisfactory.
