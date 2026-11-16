# Elevation Feature Preview – v1.1.0.1

## Scope

An experimental, independent elevation feature adds:
- Total ascent (+m) and total descent (−m) in each GPX result.
- An interactive elevation chart beneath the existing results. Select a location by tapping the chart or using the keyboard-accessible range input.
- A selected-point readout of **height difference from route start** (not altitude above sea level). The chart's vertical axis remains absolute altitude in meters; horizontal distance switches between kilometers and miles.
- German, English and Spanish labels; light and dark styling; graceful unavailable-data message.

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

- Existing `readGpx()`, `evaluate()`, `geometry-worker.js`, area calculation, Area Factor, comparison, route rendering and existing CSV layout remain unchanged. The only change to the worker URL is cache-busting the identical source for v1.1.0.1.
- Elevation calculations are in new `elevation.js`, attached to each successful result after the geometry calculation. Elevation parse failures do not invalidate a route's area analysis.
- Chart drawing is native SVG, with no external dependencies or network requests.
- Service worker cache and asset names updated so the new script and unchanged geometry worker can work offline after initial loading.
- Chart-selection-to-map-position synchronization is **not** included in this preview; reserved for a future revision.
- Do not upload a test build to the public GitHub Pages site as stable before checking real iOS, Android, desktop and offline behavior.
