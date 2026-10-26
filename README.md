# Area Efficiency Guide for INTVL

**Calculate the area enclosed by a GPX route and evaluate its efficiency.**

Area Efficiency Guide for INTVL is an offline-first Progressive Web App (PWA) that transforms GPX routes into meaningful measurements of enclosed area and route efficiency.

Import GPX tracks, calculate enclosed areas, compare routes, explore interactive maps, or evaluate distance and area values manually — all through a lightweight browser-based interface.

**[Launch the App](https://schloesy.github.io/area-efficiency-guide/)**

## The Idea Behind the Project

Area Efficiency Guide for INTVL began with one simple question:

**How much area does a pre-planned route exported as a GPX file actually enclose?**

The original goal was to create a straightforward tool that could analyze a planned route, calculate its enclosed area, and determine how efficiently the route distance surrounds that area.

What started as a focused GPX area calculator gradually evolved into a more comprehensive application, introducing interactive maps, manual efficiency calculations, multi-route comparison, and offline functionality.

Despite these additions, the original purpose remains unchanged: **turning route data into meaningful area and efficiency measurements.**

## Key Features

### GPX Route Analysis

- Import GPX files directly into the application.
- Calculate route distance and enclosed area.
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

These measurements help illustrate how effectively a given route length encloses an area.

### Interactive Maps and Route Comparison

- Visualize GPX routes and their enclosed areas.
- Explore geographic context using OpenStreetMap.
- Compare multiple routes in a shared visualization.
- Use the built-in offline route visualization without requiring online map tiles.

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

The total route distance is calculated from the geographic coordinates using the **haversine formula**.

This formula estimates the distance between two points on the Earth's surface by accounting for its curvature.

The distances between consecutive route points are added together to determine the total route length.

### 3. Checking Route Closure

To calculate an enclosed area, the route must form a sufficiently closed path.

The application checks the distance between the starting and ending points. It also verifies continuity between separate track segments.

A tolerance of **30 metres** is used for these checks.

Routes that do not meet these requirements cannot be evaluated as enclosed areas.

### 4. Projecting Geographic Coordinates

Latitude and longitude describe positions on the curved surface of the Earth, while polygon area calculations require a suitable two-dimensional representation.

The application therefore converts the geographic coordinates into a local planar coordinate system using a **Lambert azimuthal equal-area projection**.

This projection is designed to preserve area, making it suitable for evaluating enclosed regions.

### 5. Detecting Route Intersections

A GPX route does not always form a simple loop.

For example, a route may cross itself several times, creating multiple enclosed regions.

The application identifies intersections between route segments and divides the affected segments at their intersection points.

The resulting geometric network is used to identify individual enclosed faces.

### 6. Calculating Individual Enclosed Areas

Once the enclosed regions have been identified, the application calculates the area of each region using the **shoelace formula**.

This method determines polygon area from the coordinates of its boundary points.

Each detected region receives an individual area value.

The total enclosed area is calculated as the sum of these individual regions.

This allows the application to evaluate complex routes that contain multiple enclosed areas instead of treating the entire route as one simple polygon.

### 7. Calculating Efficiency

Finally, the application compares the total enclosed area with the ideal circular and square reference areas for the same route length.

The resulting efficiency percentages make it possible to compare different routes using a consistent mathematical reference.

### Calculation Accuracy and Limitations

The results are mathematical estimates based on the coordinates contained in the GPX file.

Their accuracy depends on factors such as:

- The precision and density of the GPX coordinates.
- The quality of the original route data.
- The geometric complexity of the route.
- The assumptions and numerical tolerances used during processing.

The calculation represents the geometric area enclosed by the route. It does not measure terrain surface area or account for elevation changes.

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
5. Review the route distance, enclosed area, efficiency values, and visualizations.
6. Explore individual enclosed regions or compare routes as needed.
7. Export the results to CSV for further use.

Alternatively, switch to the manual calculator to evaluate distance and area values directly — particularly for completed INTVL routes.

## Technical Overview

The application is implemented as a lightweight client-side web application using:

- HTML
- CSS
- JavaScript
- SVG for route and area visualization
- OpenStreetMap for optional online map tiles
- A web app manifest and service worker for PWA functionality

The core route analysis does not depend on a remote calculation service.

## Project Status

**Current version: v1.0.5.9**

The current application has undergone functional testing on multiple devices, with no known issues identified in the tested configurations.

Earlier development milestones are documented in the project's GitHub Releases.

## Project Philosophy

Area Efficiency Guide for INTVL is guided by four principles:

- **Purpose:** Focus on meaningful area and efficiency measurements.
- **Privacy:** Keep route analysis and GPX processing local.
- **Independence:** Minimize reliance on external services.
- **Simplicity:** Provide a clear, practical, and accessible interface.

---

**Area Efficiency Guide for INTVL**

*From a simple GPX area calculation idea to a complete offline-first route efficiency tool.*
