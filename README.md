# Point Cloud Labelling Tool

A browser-based application for manually annotating 3D point cloud data to create training datasets for machine learning models. Runs entirely locally — no data is sent to any server.

## Features

- **Interactive 3D viewer** — orbit, pan, and zoom with WebGL2-accelerated rendering of up to 50 million points
- **Selection tools** — brush (sphere/radius), smart select (region-growing), and polygon lasso
- **Label management** — create named labels with custom colours; assign selections to labels; view per-label statistics
- **Undo/redo** — full history for selection and labelling operations
- **3D bounding boxes** — place and adjust axis-aligned bounding boxes over regions
- **Performance optimisation** — automatic level-of-detail (LOD) and frustum culling for large datasets
- **Local persistence** — projects auto-save to IndexedDB every 30 seconds with up to 10 autosave versions
- **Export** — labelled data exported as JSON, PLY, CSV, or LAS

## Supported Formats

| Format | Max Size | Colours | Normals |
|--------|----------|---------|---------|
| PLY (`.ply`) | 1 GB | Yes | Yes |
| E57 (`.e57`) | 2 GB | Yes | Yes |
| PCD (`.pcd`) | 512 MB | Yes | Yes |
| XYZ (`.xyz`, `.txt`) | 256 MB | No | No |

## Requirements

- **Node.js** ≥ 18.0.0 and **npm** ≥ 9.0.0
- A browser with **WebGL2** support: Chrome ≥ 56, Firefox ≥ 51, Safari ≥ 15

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server (opens http://localhost:3000)
npm run dev
```

To create a production build:

```bash
npm run build
npm run preview   # serve the built output locally
```

## Usage

1. **Create a project** from the start screen, then drag-and-drop or browse to a point cloud file.
2. **Navigate** the 3D view: left-drag to rotate, right-drag to pan, scroll to zoom.
3. **Select points** using one of the three selection tools (`B` brush, `S` smart select, `P` polygon).
4. **Assign a label** to the current selection from the label panel, or create a new label (`Ctrl+L`).
5. **Export** labelled data from the project panel.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `B` | Brush tool |
| `S` | Smart select |
| `P` | Polygon select |
| `F` | Fit view to data |
| `R` | Reset camera |
| `G` | Toggle grid |
| `A` | Toggle axes |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` | Delete selection |
| `Escape` | Clear selection |
| `Ctrl+S` | Save project |
| `Ctrl+E` | Export |
| `Ctrl+L` | New label |
| `Ctrl+1–5` | Select label 1–5 |
| `Tab` | Toggle side panels |
| `Ctrl+/` | Show shortcuts |

## Development

```bash
npm run lint          # ESLint (zero-warnings policy)
npm run lint:fix      # Auto-fix lint issues
npm run type-check    # TypeScript type checking
npm run format        # Prettier format
npm test              # Vitest unit tests
npm run test:ui       # Vitest with browser UI
npm run test:e2e      # Playwright end-to-end tests
```

## Architecture

The application is structured in three layers:

**Core engine** (`src/core/ThreeEngine.ts`) — owns the WebGL2 renderer, scene graph, camera, orbit controls, and raycasting. All 3D operations go through this class.

**Utilities** (`src/utils/`) — framework-independent business logic: file parsing coordination (`fileProcessing.ts`), selection algorithms (`selectionManager.ts`), label operations (`labelManager.ts`), IndexedDB persistence (`projectManager.ts`), and performance optimisation (`performanceOptimizer.ts`).

**React UI** (`src/components/`) — thin presentation layer. `BasicViewport.tsx` bridges DOM mouse events to `ThreeEngine`; the remaining components handle panels, tools, and project management.

Large file parsing runs in a Web Worker (`src/workers/plyParser.worker.ts`) to keep the UI thread responsive.

## License

MIT License

Copyright (c) 2024 Point Cloud Labelling Tool Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
