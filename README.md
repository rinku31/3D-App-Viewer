# 3D App Viewer

3D App Viewer is a lightweight, browser-based toolset for authoring and displaying interactive 3D product showcases. It features a visual **Editor** for creating and positioning interactive hotspots, custom lights, and scene configurations on GLB/glTF 3D models, as well as a standalone **Viewer** and **Embed Viewer** for presenting 3D products with animated annotations, camera turntable controls, exploded views, and external integration hooks.

## Features

- **Model Compatibility**: Import and display standard and Draco-compressed `.glb` / `.gltf` 3D models.
- **Hotspot Authoring & Presentation**: Create, drag, and configure 3D hotspots with custom titles, descriptions, feature bullet lists, colors, and actionable buttons.
- **Dynamic 3D Lighting**: Interactive directional, point, spot, and ambient light authoring and scene synchronization.
- **Screen-Space Annotation Overlays**: Real-time 2D/3D coordinate projection with animated SVG connector lines and geometric occlusion detection.
- **Camera Controls & Turntable**: Multi-pivot orbit rig with smooth damping, framing, reset view, and automated 360° turntable rotation with adjustable speed multipliers (0.5x to 3x).
- **Exploded View Mode**: Interactive animated component separation for inspecting internal parts.
- **Environment Lighting & Bloom**: HDR environment presets (Studio, Urban, Nature, Industrial) and toggleable post-processing bloom glow.
- **Schema v2 JSON Import/Export**: Persistent scene document storage and migration.
- **Standalone Embeddable Viewer**: Optimized `/Embed/` package for `<iframe>` embedding with dynamic URL query parameters and cross-window communication.
- **Custom JavaScript Callback Hooks**: Trigger custom JavaScript functions and `postMessage` events when users click Hotspot action buttons or the Viewer Simulator button.

## Folder structure

```text
.
├── Editor/                     # Scene authoring tool for hotspots, lighting, and model setup
│   ├── editor.html             # Editor web interface
│   ├── editor.js               # Editor main entry point
│   ├── bootstrap/              # Core initialization and event binding
│   ├── gizmo/                  # TransformControls for object manipulation
│   ├── hierarchy/              # Outliner tree and scene hierarchy
│   ├── hotspots/               # Hotspot creation and editing
│   ├── inspector/              # Property inspector for selected entities
│   ├── io/                     # Model and JSON schema import/export
│   ├── lights/                 # Lighting authoring tools
│   ├── render/                 # Three.js setup and render loop
│   ├── selection/              # Universal selection system
│   ├── state/                  # Shared Editor state
│   └── ui/                     # UI controls and dialogs
├── Viewer/                     # Standalone presentation showcase application
│   ├── viewer.html             # Full-page viewer interface
│   ├── viewer.js               # Viewer entry point
│   ├── assets/Products/        # Bundled 3D models (.glb) and scene JSON files
│   ├── bootstrap/              # Viewer initialization and orchestration
│   ├── lights/                 # Presentation lighting manager
│   ├── loading/                # Model loader and JSON parser
│   ├── overlay/                # 2D hotspot cards and SVG connector lines
│   ├── render/                 # Three.js rendering and bloom post-processing
│   ├── state/                  # Viewer state
│   └── ui/                     # Floating HUD and action stack
├── Embed/                      # Lightweight embeddable viewer for iframes and CMS integration
│   ├── index.html              # Clean embed page
│   ├── embed.js                # Embed entry point and query parameter handler
│   ├── bootstrap/              # Embed bootstrap and postMessage API
│   ├── lights/                 # Lighting subsystem
│   ├── loading/                # Asset and JSON loading
│   ├── overlay/                # Hotspot overlays and event dispatching
│   ├── render/                 # WebGL render loop
│   ├── state/                  # Embed state singleton
│   ├── style.css               # Embed UI and overlay styling
│   ├── ui/                     # Floating HUD and Quick Action stack
│   └── visibility/             # Hotspot occlusion testing
├── shared/                     # Shared modules across Editor, Viewer, and Embed
│   ├── bloom.js                # Bloom glow post-processing shader pipeline
│   ├── CameraRig.js            # Multi-pivot camera orbit and fly-to rig
│   ├── disposal.js             # Three.js memory and GPU resource cleanup
│   ├── environment.js          # HDR presets and environment manager
│   ├── hotspotMath.js          # Coordinate projection and SVG connector calculations
│   ├── lights.js               # Three.js light factory helpers
│   └── schema.js               # Schema v2 specification, validation, and migration
├── libs/                       # Draco decoder binaries and scripts
│   └── draco/gltf/             # Draco WebAssembly and JS decoders
├── docs/                       # Project documentation
├── metadata.json               # Application metadata
├── package.json                # Project configuration
├── README.md                   # Project documentation
└── server.js                   # Static development server
```

## Requirements

- **Browser**: Modern web browser with WebGL 2 support (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge).
- **HTTP/HTTPS Web Server**: A static web server (such as Nginx, Apache, Caddy, Node.js, or cloud static hosting/CDN). *Running directly from the filesystem (`file://`) is not supported due to browser ES module and CORS security restrictions.*
- **Network Access**: Internet connectivity to load CDN resources (Three.js and HDR environment assets).
- **Zero Build Step**: No bundler, compiler, or Node.js package installation is required.

## How to host the Embed folder in an existing server

To host the embeddable 3D viewer on an existing web server or static asset host:

1. **Deploy Directories**:
   Upload the `/Embed/` folder and the `/shared/` folder to your static web root so that relative imports resolve correctly (e.g., `https://your-domain.com/Embed/` and `https://your-domain.com/shared/`).

2. **Configure MIME Types**:
   Ensure your web server serves standard file extensions with the correct `Content-Type` headers:
   - `.js` / `.mjs` &rarr; `application/javascript`
   - `.json` &rarr; `application/json`
   - `.glb` / `.gltf` &rarr; `model/gltf-binary` or `application/octet-stream`
   - `.wasm` &rarr; `application/wasm`

3. **Enable Cross-Origin Resource Sharing (CORS)**:
   If your 3D models (`.glb`), JSON scene files, or textures are hosted on a separate domain or CDN, enable CORS headers on the asset host:
   ```http
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, OPTIONS
   ```

4. **Verify Direct Access**:
   Navigate to `https://your-domain.com/Embed/index.html` in your browser to verify that the viewer loads successfully.

## How to embed viewer in a webpage

Embed the viewer into any HTML page, CMS (WordPress, Shopify, Webflow), or web application using an `<iframe>`:

```html
<iframe
  src="https://your-domain.com/Embed/index.html?glb=https://your-domain.com/assets/model.glb&json=https://your-domain.com/assets/model.json&turntable=1&speed=1x&env=studio_small_09"
  width="100%"
  height="600"
  frameborder="0"
  allow="fullscreen; xr-spatial-tracking"
  style="border: none; border-radius: 8px; overflow: hidden; width: 100%; height: 600px;"
></iframe>
```

### URL Query Parameters

| Parameter | Aliases | Description | Example |
| :--- | :--- | :--- | :--- |
| `glb` | `model`, `gltf` | Absolute or relative URL to the `.glb` 3D model | `?glb=/models/product.glb` |
| `json` | `scene` | Absolute or relative URL to the Schema v2 scene JSON | `?json=/models/product.json` |
| `title` | &mdash; | Product/scene title shown on the top-left HUD badge | `?title=Gaming+Mouse` |
| `env` | `preset` | Environment lighting preset (`studio_small_09`, `potsdamer_platz`, `autumn_ground`, `aircraft_workshop`) | `?env=potsdamer_platz` |
| `turntable` | `autorotate` | Enable 360° automatic rotation on load (`1` or `true`) | `?turntable=1` |
| `speed` | &mdash; | Initial turntable rotation speed (`0.5x`, `1x`, `1.5x`, `2x`, `3x`) | `?speed=1.5x` |
| `bg` | `background` | Viewport background color in hex format | `?bg=%2318181b` |

### Test Embed Functionality

If you want to see Embed in action, [Click this link](https://quietlang13.github.io/3D-IPE-Files/).

## How Calling a JS function work when Hotspot Show article button and Viewer Simulator button is clicked

The viewer supports bidirectional integration with the host webpage through direct window function invocation and cross-origin `postMessage` events.

### 1. Hotspot "Show Article" Button

When a hotspot has its action button enabled in the scene JSON (`button.enabled: true`):

- **Trigger**: The user clicks the button inside the hotspot information panel.
- **Direct Function Call**: If a JavaScript function name is specified (`button.jsFunction`), the viewer checks for `window.parent[funcName]` (or `window[funcName]`) and executes it, passing the hotspot data object as an argument:
  ```javascript
  // In the parent webpage:
  window.handleHotspotArticle = function(hotspot) {
    console.log("Hotspot clicked:", hotspot.id, hotspot.title);
    // Custom logic: open modal, scroll to section, trigger analytics, etc.
  };
  ```
- **PostMessage Event**: The viewer also broadcasts a `HOTSPOT_BUTTON_CLICK` event to the parent window:
  ```javascript
  // In the parent webpage:
  window.addEventListener("message", (event) => {
    if (event.data?.type === "HOTSPOT_BUTTON_CLICK") {
      const { functionName, hotspot } = event.data;
      console.log("Function requested:", functionName);
      console.log("Hotspot details:", hotspot);
    }
  });
  ```
- **URL Navigation (Optional)**: If `button.url` is populated, the viewer also opens the link in a new browser tab (`_blank`).

---

### 2. Viewer "Simulator" Button

The Simulator button is located in the middle-right Quick Action stack of the viewer HUD:

- **Trigger**: The user clicks the **Simulator** button to toggle interactive testing mode on or off.
- **Direct Function Call**: The viewer resolves the configured simulator function name (`controls.simulatorJsFunction` or `onSimulatorToggle`) and invokes `window.parent[funcName]` with a state payload:
  ```javascript
  // In the parent webpage:
  window.onSimulatorToggle = function(payload) {
    console.log("Simulator active state:", payload.active);   // true or false
    console.log("Action:", payload.action);                  // "start" or "stop"
    console.log("Model:", payload.modelName);
  };
  ```
- **PostMessage Event**: The viewer emits a `SIMULATOR_TOGGLE` event to `window.parent`:
  ```javascript
  // In the parent webpage:
  window.addEventListener("message", (event) => {
    if (event.data?.type === "SIMULATOR_TOGGLE") {
      console.log("Simulator status:", event.data.active);
      console.log("Event details:", event.data);
    }
  });
  ```
- **URL Navigation (Optional)**: If a simulator URL is defined in the scene configuration (`controls.simulatorUrl`), the link opens in a new tab upon activation.
