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

The embeddable viewer in `/Embed/` is a zero-build, static package designed for rapid deployment onto any web server, CDN, or static hosting service.

### 1. Deployment Requirements & Folder Layout
Because `/Embed/` imports shared modules (math, schema validation, HDR presets, camera rig) from `../shared/`, **both folders must be deployed as siblings in your web directory**:

```text
your-web-root/
├── Embed/                      # Embed viewer files
│   ├── index.html              # HTML entry point for iframes
│   ├── embed.js
│   ├── style.css
│   └── ...
└── shared/                     # Shared Three.js / math / schema dependencies
    ├── hotspotMath.js
    ├── schema.js
    ├── CameraRig.js
    ├── environment.js
    ├── bloom.js
    └── ...
```

> **Note**: Three.js is loaded dynamically via CDN import maps (`esm.sh`), and Draco mesh decoders are automatically loaded from Google GStatic CDN. You do not need to install `node_modules` or compile build artifacts.

### 2. Static Hosting Quick Guides

- **GitHub Pages**: Place `/Embed/` and `/shared/` in your repository root or `docs/` folder, and enable GitHub Pages in Repository Settings.
- **Vercel / Netlify / Cloudflare Pages**: Deploy the project root directory directly as a static site (leave the build command empty, publish directory as `.`).
- **Nginx / Apache / S3 + CloudFront**: Copy `/Embed/` and `/shared/` into your public HTML root.

### 3. Configure MIME Types
Ensure your web server serves standard file types with correct headers:
- `.js` / `.mjs` &rarr; `application/javascript`
- `.json` &rarr; `application/json`
- `.glb` / `.gltf` &rarr; `model/gltf-binary` or `application/octet-stream`
- `.wasm` &rarr; `application/wasm`

### 4. Enable Cross-Origin Resource Sharing (CORS)
If your 3D models (`.glb`), scene JSON files, or images are hosted on a different domain or external CDN, the asset server must return CORS headers:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

---

## How to embed viewer in a webpage

Embed the viewer into any HTML page, CMS (WordPress, Shopify, Webflow), or web application using a responsive `<iframe>`:

```html
<iframe
  id="productViewer"
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
| `title` | &mdash; | Product/scene title shown on the top-left HUD badge | `?title=Gaming+Headset` |
| `env` | `preset` | Environment lighting preset (`studio_small_09`, `potsdamer_platz`, `autumn_ground`, `aircraft_workshop`) | `?env=studio_small_09` |
| `turntable` | `autorotate` | Enable 360° automatic rotation on load (`1` or `true`) | `?turntable=1` |
| `speed` | &mdash; | Initial turntable rotation speed (`0.5x`, `1x`, `1.5x`, `2x`, `3x`) | `?speed=1.5x` |
| `bg` | `background` | Viewport background color in hex format | `?bg=%2318181b` |

---

## PostMessage & JavaScript Integration API

The Embed viewer supports full bidirectional communication between the host page and the iframe.

### 1. Controlling the Viewer from the Host Page (Incoming Messages)

Send messages to the iframe using `iframeElement.contentWindow.postMessage(message, "*")`:

| Message Type | Payload Structure | Description |
| :--- | :--- | :--- |
| `RESET_CAMERA` | `{ type: "RESET_CAMERA" }` | Resets camera framing and orientation back to initial default |
| `TOGGLE_TURNTABLE` | `{ type: "TOGGLE_TURNTABLE", enabled?: boolean, speed?: string }` | Starts, stops, or toggles turntable rotation (optional speed: `"0.5x"` to `"3x"`) |
| `SET_SPEED` | `{ type: "SET_SPEED", speed: "1.5x" }` | Updates turntable speed multiplier |
| `SET_ENVIRONMENT` | `{ type: "SET_ENVIRONMENT", preset: "potsdamer_platz" }` | Switches HDR lighting environment |
| `FLY_TO_HOTSPOT` | `{ type: "FLY_TO_HOTSPOT", index: 0 }` | Smoothly animates camera to focus on a specific hotspot index |
| `LOAD_MODEL` | `{ type: "LOAD_MODEL", url: "...", companionJson?: object }` | Dynamically swaps the 3D model without reloading the iframe |
| `LOAD_SCENE` | `{ type: "LOAD_SCENE", json?: object, url?: string }` | Loads new scene metadata, lighting, and hotspots |
| `SET_TITLE` | `{ type: "SET_TITLE", title: "New Title" }` | Updates the top-left HUD title badge |

### 2. Listening to Viewer Events (Outgoing Messages)

Listen for events sent from the viewer iframe in your parent window:

```javascript
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case "3D_VIEWER_READY":
      console.log("3D Viewer is ready. Model loaded:", data.modelName);
      break;

    case "HOTSPOT_BUTTON_CLICK":
      console.log("Hotspot action button clicked:", data.hotspot);
      console.log("Custom JS function requested:", data.functionName);
      // Example: Open custom modal, trigger checkout, or track analytics
      break;

    case "SIMULATOR_TOGGLE":
      console.log("Simulator toggled:", data.active, "Model:", data.modelName);
      break;
  }
});
```

---

## Hotspot Scene JSON Schema (Multi-Section)

Hotspots support modular content blocks through the `sections` array. Each section contains its own description, bullet list, and right-aligned action buttons:

```json
{
  "version": "2.0.0",
  "hotspots": [
    {
      "id": "hotspot_mic",
      "title": "Detachable Razer HyperClear Mic",
      "position": [0.15, 0.42, -0.08],
      "panelOffset": { "x": 220, "y": -80 },
      "color": "#44D62C",
      "sections": [
        {
          "description": "For voice capture and transmission quality.",
          "listItems": [
            "Noise cancellation",
            "Wide frequency response"
          ],
          "buttons": [
            {
              "enabled": true,
              "text": "View Specs",
              "url": "https://example.com/specs",
              "jsFunction": "onViewSpecs"
            }
          ]
        },
        {
          "description": "Easily clips onto the left earcup.",
          "listItems": ["Magnetic lock", "Gold-plated 3.5mm jack"],
          "buttons": [
            {
              "enabled": true,
              "text": "Buy Replacement",
              "url": "https://example.com/shop",
              "jsFunction": "onBuyReplacement"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Complete Parent Page Integration Example

Here is a copy-paste example showing how to embed the viewer, control it with custom UI buttons, and handle user interactions:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>3D Product Showcase</title>
  <style>
    body { font-family: sans-serif; background: #0f0f12; color: #fff; margin: 0; padding: 20px; }
    .viewer-container { max-width: 1000px; margin: 0 auto; }
    .viewer-frame { width: 100%; height: 600px; border: 1px solid #333; border-radius: 8px; }
    .controls { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    button { background: #222; color: #fff; border: 1px solid #444; padding: 8px 14px; border-radius: 4px; cursor: pointer; }
    button:hover { background: #333; border-color: #44d62c; }
  </style>
</head>
<body>
  <div class="viewer-container">
    <h2>Interactive 3D Showcase</h2>
    <iframe
      id="myViewer"
      class="viewer-frame"
      src="/Embed/index.html?glb=/assets/model.glb&json=/assets/model.json&turntable=1&env=studio_small_09"
      allow="fullscreen; xr-spatial-tracking"
    ></iframe>

    <div class="controls">
      <button onclick="sendToViewer({ type: 'RESET_CAMERA' })">Reset View</button>
      <button onclick="sendToViewer({ type: 'TOGGLE_TURNTABLE' })">Toggle 360° Rotation</button>
      <button onclick="sendToViewer({ type: 'FLY_TO_HOTSPOT', index: 0 })">Focus Hotspot #1</button>
      <button onclick="sendToViewer({ type: 'SET_ENVIRONMENT', preset: 'potsdamer_platz' })">Outdoor Lighting</button>
    </div>
  </div>

  <script>
    const iframe = document.getElementById("myViewer");

    function sendToViewer(message) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, "*");
      }
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "HOTSPOT_BUTTON_CLICK") {
        alert(`Action clicked: ${event.data.hotspot.title}`);
      }
    });
  </script>
</body>
</html>
```

---

## Troubleshooting & Common Pitfalls

1. **Viewer is blank or says "Failed to load model" (CORS Issue)**:
   - If loading assets from S3, GitHub, or another domain, verify that the asset server sends `Access-Control-Allow-Origin: *`.
2. **"Failed to resolve module specifier" or 404 on `../shared/`**:
   - Ensure the `/shared/` directory is deployed alongside `/Embed/` in the same relative parent folder.
3. **Running locally via `file:///`**:
   - Browsers block ES module imports and fetch requests over `file://`. Always use a local static server (e.g. `npx serve`, `python -m http.server 8000`, or VS Code Live Server).
4. **Mixed Content Warning**:
   - If your host website runs on `https://`, all iframe `src` URLs and query parameter asset links must also use `https://`.
