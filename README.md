# Area Efficiency Guide for INTVL

**Calculate the area enclosed by a GPX route and evaluate its efficiency.**

Area Efficiency Guide for INTVL is a privacy-conscious, offline-first Progressive Web App (PWA) that transforms GPX routes into measurements of enclosed area and route efficiency.

Import GPX tracks, calculate enclosed areas, compare routes, explore interactive maps, or evaluate distance and area values manually — all through a lightweight browser-based interface.

**[Launch the App](https://schloesy.github.io/area-efficiency-guide/)**

## The Idea Behind the Project

Area Efficiency Guide for INTVL began with one simple question:

**How much area does a pre-planned route exported as a GPX file actually enclose?**

The original goal was to create a straightforward tool that could analyze a planned route, calculate its enclosed area, and determine how efficiently the route distance surrounds that area.

What started as a focused GPX area calculator gradually evolved into a more comprehensive application, introducing interactive maps, manual efficiency calculations, multi-route comparison, support for open routes, and offline functionality.

Despite these additions, the original purpose remains unchanged: **turning route data into meaningful area and efficiency measurements.**

## Key Features

### GPX Route Analysis

- Import GPX files using the file picker or drag and drop (desktop browsers).
- Calculate recorded route distance and enclosed area.
- Automatically connect the end of an open route to its start with a straight line **for area calculation**, without adding that connection to the recorded route distance.
- Detect and calculate individual enclosed regions, including regions formed by route intersections.
- Display the total enclosed area and a breakdown of individual regions.
- Evaluate route efficiency against ideal geometric reference shapes.
- Export calculated route metrics as CSV.

### Area Efficiency Calculation

The application compares the enclosed area of a route with the maximum area that could theoretically be enclosed by a circle or the area enclosed by a square with the same perimeter.

For a route distance of **L** and an enclosed area of **A**:

**Ideal circular area:**

A_circle = L² / (4π)

**Circular efficiency:**

Efficiency_circle = (A / A_circle) × 100%

**Ideal square area:**

A_square = L² / 16

**Square efficiency:**

Efficiency_square = (A / A_square) × 100%

A perfectly circular route provides the theoretical maximum enclosed area for a given perimeter. The square serves as an additional geometric reference.

These measurements help illustrate how effectively a given route length encloses an area. For open routes, the closing connection is used to define the area, while efficiency calculations use the original recorded distance; consequently, the ideal-shape comparison should be interpreted with that distinction in mind.

### Interactive Maps and Route Comparison

- Visualize GPX routes, enclosed areas, and individual regions.
- Explore geographic context using OpenStreetMap (OSM) when online map tiles are available.
- Compare multiple routes in a shared visualization.
- Use the built-in offline route visualization without online map tiles.
- Identify open-route closing connections as dashed lines, distinct from the recorded route.
- Navigate large recorded routes with optimized tile handling and zoom-dependent route rendering.

### Manual Efficiency Calculator

The manual efficiency calculator is particularly useful for evaluating routes already completed on INTVL.

Although INTVL provides both the route distance and enclosed area, it does not offer GPX export. By entering these values manually, users can calculate the route's circular and square efficiency without needing a GPX file.

The calculator can also be used to explore theoretical examples or evaluate measurements obtained from other sources.

## How the GPX Calculation Works

The application performs its calculations directly in the browser. The analysis combines geographic distance calculations with geometric processing to determine the area enclosed by a route.

### 1. Reading the GPX File

The application extracts geographic coordinates from the GPX file.

It supports GPX track segments and GPX route points. Coordinates are checked for validity before further processing.

### 2. Calculating Route Distance

The total recorded route distance is calculated from the geographic coordinates using the **haversine formula**.

This formula estimates the distance between two points on the Earth's surface by accounting for its curvature.

The distances between consecutive recorded route points are added together to determine the route length. An automatically generated closing connection is **not** included in this distance.

### 3. Checking Continuity and Closing Open Routes

The application checks continuity between separate GPX track segments, using a tolerance of **30 metres** for segment continuity checks.

For area calculation, the end of an open route is connected to its start by a straight line. This closes the geometry used to identify enclosed regions, while preserving the original recorded route distance.

The generated connection is shown separately in map views, so users can distinguish the recorded track from the area-closing line. Invalid or discontinuous GPX data may still prevent a valid calculation.

### 4. Projecting Geographic Coordinates

Latitude and longitude describe positions on the curved surface of the Earth, while polygon area calculations require a suitable two-dimensional representation.

The application therefore converts the geographic coordinates into a local planar coordinate system using a **Lambert azimuthal equal-area projection**.

This projection is designed to preserve area, making it suitable for evaluating enclosed regions.

### 5. Detecting Route Intersections

A GPX route does not always form a simple loop.

For example, a route may cross itself several times, creating multiple enclosed regions.

The application identifies intersections between route segments and divides the affected segments at their intersection points. Spatial filtering reduces unnecessary intersection checks for complex recordings.

The resulting geometric network is used to identify individual enclosed faces. Geometry processing runs in a dedicated **Web Worker** where supported, helping keep the interface responsive during calculations.

### 6. Calculating Individual Enclosed Areas

Once the enclosed regions have been identified, the application calculates the area of each region using the **shoelace formula**.

This method determines polygon area from the coordinates of its boundary points.

Each detected region receives an individual area value. The total enclosed area is calculated as the sum of these individual regions.

This allows the application to evaluate complex routes that contain multiple enclosed areas instead of treating the entire route as one simple polygon.

### 7. Calculating Efficiency

Finally, the application compares the total enclosed area with the ideal circular and square reference areas for the same recorded route length.

The resulting efficiency percentages make it possible to compare different routes using a consistent mathematical reference, subject to the open-route distinction explained above.

### Calculation Accuracy and Limitations

The results are mathematical estimates based on the coordinates contained in the GPX file.

Their accuracy depends on factors such as:

- The precision and density of the GPX coordinates.
- The quality of the original route data.
- The geometric complexity of the route.
- The assumptions and numerical tolerances used during processing.

The calculation represents the geometric area enclosed by the route. It does not measure terrain surface area or account for elevation changes.

**Map rendering and calculation are separate:** At some zoom levels, the displayed route may be visually simplified to improve navigation performance. The original GPX coordinates are retained for distance, area, and efficiency calculations. Visual simplification does not reduce the number of points used in those calculations.

Large or unusually complex files may still be constrained by browser memory, processing time, or geometric complexity. No universal maximum file size or processing speed is guaranteed.

## Offline-First & Privacy by Design

**Offline by default. Online only when necessary.**

Area Efficiency Guide for INTVL is designed to keep its core functionality available locally in the browser.

- GPX files are processed locally.
- Route coordinates are not uploaded to an application server for analysis.
- Area and efficiency calculations run in the browser.
- A service worker caches application resources for offline use.
- OpenStreetMap tiles require network access when the online map view is used and tiles are not already available.

After the application has been loaded and its required resources have been cached, its core functionality can be used without an active internet connection.

The offline-first approach is a fundamental design principle, not an optional extra.

## How to Use

1. Open the application in a supported web browser.
2. Select the GPX analysis view.
3. Import one or more GPX files.
4. Start the calculation.
5. Review the recorded route distance, enclosed area, efficiency values, and visualizations.
6. Explore individual enclosed regions or compare routes as needed.
7. Export the results to CSV for further use.

Alternatively, switch to the manual calculator to evaluate distance and area values directly — particularly for completed INTVL routes.

## Technical Overview

The application is implemented as a lightweight client-side web application using:

- HTML
- CSS
- JavaScript
- SVG for route and area visualization
- A dedicated Web Worker for geometry processing
- OpenStreetMap for optional online map tiles
- A web app manifest and service worker for PWA functionality

Optimized route drawing and tile reuse support smoother map navigation, including on mobile devices. The SVG overlay uses a consistent coordinate scale to support cross-browser rendering.

The core route analysis does not depend on a remote calculation service.

## Development & AI Collaboration

**Transparency about how this project was built is important.**

The project owner **did not personally write the application's source code**. Area Efficiency Guide for INTVL was developed through an iterative collaboration between the project owner and **ChatGPT (OpenAI)**.

The project owner originated the idea, defined the goals and requirements, made product and design decisions, reviewed proposed changes, tested the application on desktop and mobile devices, reported defects, and validated improvements against real GPX routes.

ChatGPT assisted with the technical design, source-code generation and modification, debugging, performance optimization, documentation, and preparation of versioned project files and GitHub release text.

Development followed a human-directed process: proposed changes were reviewed and tested by the project owner, who decided which versions to adopt and publish. **AI-generated code and explanations should not be assumed to be independently verified solely because they were produced with AI assistance.**

This disclosure is intended to credit the collaboration accurately and make the development process understandable to users and contributors.

## Project Status & Releases

**Current stable reference version: v1.0.8.5**

The v1.0.8.5 release was validated by the project owner with a recorded GPX route containing approximately 8,800 points, including tests of map navigation and route comparison. Route rendering was also checked in Firefox and Chrome on desktop and on a Samsung Galaxy S20 FE 5G smartphone. These tests are not a guarantee of identical behavior on every device or browser.

### Selected Development Milestones

- **[v1.0.7.5 — Open GPX Route Support (Pre-release)](https://github.com/Schloesy/area-efficiency-guide/releases/tag/v1.0.7.5):** Historical milestone covering automatic closure of open routes, preserved recorded distance, comparison views, and clearer map legends. Introduced in v1.0.7.0 and refined through v1.0.7.5.
- **v1.0.8.0–v1.0.8.1 — Geometry Processing:** Introduced spatially filtered intersection detection and a geometry Web Worker; corrected GPX parsing across worker boundaries.
- **v1.0.8.2–v1.0.8.3 — Map Performance:** Improved OSM tile reuse and optimized SVG route rendering for large recordings.
- **v1.0.8.4 — Route Alignment:** Improved coordinate precision to prevent visible route movement relative to the map at high zoom levels.
- **[v1.0.8.5 — Stable Performance & Compatibility](https://github.com/Schloesy/area-efficiency-guide/releases/tag/v1.0.8.5):** Established the tested stable reference version with consistent SVG rendering in Firefox and Chrome.

See [GitHub Releases](https://github.com/Schloesy/area-efficiency-guide/releases) for published release notes and versioned source snapshots.

## Project Philosophy

Area Efficiency Guide for INTVL is guided by five principles:

- **Purpose:** Focus on meaningful area and efficiency measurements.
- **Privacy:** Keep route analysis and GPX processing local.
- **Independence:** Minimize reliance on external services.
- **Simplicity:** Provide a clear, practical, and accessible interface.
- **Transparency:** Document limitations, development decisions, and AI-assisted implementation openly.

---

**Area Efficiency Guide for INTVL**

*From a simple GPX area calculation idea to a complete offline-first route efficiency tool — built through human-directed, AI-assisted development.*


### v1.0.9.0 – Partial area visualization

- Enclosed areas are listed by descending area (A is the largest), with matching labels on offline and OpenStreetMap views.
- Individual enclosed-area details are collapsed by default; km² remains the default display unit and m² is available.
- Small or crowded enclosed areas use nearby label callouts with thin leader lines when room permits. Map fills, route styles and geometry calculations are unchanged.


### v1.0.9.1 – Smart area label placement

- Improved map label placement to avoid recorded route lines and collisions between label leaders.
- Leader lines end at the label circle edge; previous relative positions are preferred to reduce jumping when panning.
- Calculations, route drawing, area fill colors, and collapsed area list remain unchanged.
