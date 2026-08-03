# 3D App Viewer

3D App Viewer is a browser-based toolset for building and presenting interactive 3D product experiences. It contains an **Editor** for placing and configuring annotations on GLB models, and a **Viewer** for displaying those annotations to end users.

The project intentionally stays lightweight: it uses native browser modules, Three.js, and local files rather than a build system or backend service.

## Features

- Import Draco-compressed or standard GLB models.
- Create, select, move, edit, and delete product hotspots in the Editor.
- Drag hotspot information panels and persist their offsets.
- Import and export hotspot JSON.
- Add, select, configure, and delete directional lights in the Editor.
- Frame imported models automatically.
- Render interactive Viewer hotspots with hover panels, connector lines, and occlusion checks.
- Load an HDR environment and use ACES filmic tone mapping in both applications.

## Folder structure

```text
.
├── Editor/                     # Authoring application
│   ├── editor.html             # Editor page
│   ├── editor.js               # Editor entrypoint
│   ├── bootstrap/              # Application orchestration and input binding
│   ├── hotspots/               # Hotspot data, interaction, and overlay rendering
│   ├── io/                     # Model and JSON import/export
│   ├── lights/                 # Editor directional-light tools
│   ├── render/                 # Three.js setup and render loop
│   ├── state/                  # Shared Editor state
│   └── ui/                     # General UI behavior
├── Viewer/                     # Presentation application
│   ├── viewer.html             # Viewer page
│   ├── viewer.js               # Viewer runtime
│   └── assets/Products/        # Product GLB and JSON assets
├── docs/                       # Architecture and contributor documentation
├── README.md                   # Project introduction and setup
├── ROADMAP.md                  # Product milestones
└── TODO.md                     # Deferred engineering work
```

## Requirements

- A modern browser with WebGL 2 support (Chrome, Edge, Firefox, or Safari).
- A local static HTTP server. Opening the pages directly with `file://` is not supported because browser module and fetch restrictions can prevent assets from loading.
- Internet access while developing, because Three.js, Draco decoders, HDR environments, and an editor sprite texture are currently loaded from CDNs.

No Node.js package installation is required.

## Run the Editor

From the project root, start a static server. Python is one option:

```sh
py -m http.server 8000
```

Open [http://localhost:8000/Editor/editor.html](http://localhost:8000/Editor/editor.html). Import a `.glb` model, then add or import hotspots. Export the JSON when authoring is complete.

## Run the Viewer

With the same server running, open [http://localhost:8000/Viewer/viewer.html](http://localhost:8000/Viewer/viewer.html).

Select a `.glb` file in the Viewer. The Viewer derives the JSON filename from the selected model name and requests:

```text
/Viewer/assets/Products/<model-name>.json
```

For example, selecting `Viper V4 Pro.glb` requests `Viper V4 Pro.json`. Keep the model filename and the published JSON filename aligned.

## Development workflow

1. Serve the project from its root with a local HTTP server.
2. Make a focused change in the owning module; see [docs/Architecture.md](docs/Architecture.md).
3. Test the Editor import, hotspot editing, export flow, and Viewer rendering flow.
4. Confirm Editor-exported JSON still works in the Viewer before committing.
5. Keep commits small and update documentation whenever a supported behavior or data format changes.

For project conventions, read [docs/Contributing.md](docs/Contributing.md) and [AI_GUIDELINES.md](AI_GUIDELINES.md).

## Technology stack

| Area | Technology |
| --- | --- |
| 3D engine | [Three.js](https://threejs.org/) `0.160.0` |
| Model format | GLB / glTF, with Draco decoder support |
| Rendering | WebGL, HDR environment maps, ACES filmic tone mapping |
| Application model | Native ES modules and browser DOM APIs |
| Styling | Plain CSS |
| Data interchange | JSON |

## Project philosophy

The project favors understandable, incremental development over framework-heavy abstractions. Editor and Viewer remain separate applications with a clear shared data contract. Existing behavior is treated as valuable: improve it in focused steps, preserve compatibility, and avoid replacing working systems unless a change is explicitly requested.
