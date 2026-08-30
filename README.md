# 3D App Viewer

3D App Viewer is a lightweight, browser-based toolset for authoring and presenting interactive 3D product showcases. Built on **Three.js** with a zero-build architecture, it includes:
- **3D Editor**: A visual authoring studio for placing interactive hotspots, configuring custom lighting rigs, and styling 3D models.
- **Presentation Viewer**: A standalone full-screen showcase viewer with floating HUD controls and model upload capabilities.
- **Embeddable Viewer**: An optimized, lightweight viewer designed for seamless `<iframe>` embedding in websites, e-commerce stores, and web applications.

---

## Key Features

- **Model Compatibility**: Loads standard and Draco-compressed `.glb` and `.gltf` 3D assets.
- **Interactive Hotspots**: Author and present 3D hotspots featuring modular multi-section cards, bullet lists, and actionable buttons.
- **Screen-Space Annotation Overlays**: Real-time 3D-to-2D projection with animated SVG connector leader lines and geometric occlusion detection.
- **Camera Controls & Turntable**: Multi-pivot orbit rig with smooth damping, automatic framing, collision-safe positioning, and 360° turntable rotation with adjustable speed multipliers (`0.5x`, `1x`, `1.5x`, `2x`, `3x`).
- **Exploded View Mode**: One-click animated parts separation for inspecting internal product components.
- **Environment Lighting & Bloom**: Built-in HDR environment presets (*Studio*, *Urban*, *Nature*, *Industrial*) with toggleable post-processing bloom glow.
- **Schema v2 JSON**: Standardized, human-readable scene document format with built-in schema migration and validation.
- **Bidirectional Integration API**: Control the viewer via `postMessage` commands and listen for user interactions (hotspot button clicks, simulator toggles, and custom JavaScript callbacks).

---

## Project Structure

```text
├── shared/                     # Single Source of Truth for 3D Engine & Schema
│   ├── viewerCore.js           # Unified 3D presentation engine (render loop, postMessage, URL params)
│   ├── viewerLoader.js         # Unified GLTF/Draco loader & Scene JSON ingestion
│   ├── viewerHUD.js            # Universal HUD (turntable, speed, exploded view, simulator, auto-hide)
│   ├── hotspotOverlay.js       # 2D screen annotations, multi-section cards & SVG leader lines
│   ├── hotspotMath.js          # 3D projection, occlusion raycasting & line geometry
│   ├── CameraRig.js            # Multi-pivot orbit camera with smooth damping & fly-to transitions
│   ├── schema.js               # Canonical Schema v2.0.0 specification & migration pipeline
│   ├── environment.js          # HDR environment presets & tone mapping
│   ├── bloom.js                # Post-processing bloom shader pipeline
│   ├── lights.js               # 3-point lighting rig generator & scene light synchronization
│   └── disposal.js             # GPU memory cleanup & leak prevention
│
├── Editor/                     # Scene Authoring Studio
│   ├── editor.html / editor.js # Visual editor interface & bootstrap
│   ├── hierarchy/              # Scene outliner tree & mesh filter
│   ├── inspector/              # Property inspector for transforms, materials & lights
│   ├── gizmo/                  # TransformControls (Translate / Rotate / Scale)
│   ├── hotspots/               # Hotspot creator & pin placement
│   ├── selection/              # Raycast object selection
│   ├── state/                  # Undo/redo history & editor state
│   └── io/                     # Import & export scene JSON / GLTF packaging
│
├── Viewer/                     # Standalone Presentation Showcase
│   ├── viewer.html / viewer.js # Full-page viewer interface
│   ├── style.css               # Presentation theme & header styles
│   └── assets/Products/        # Bundled demo 3D models and companion JSON scenes
│
├── Embed/                      # Compact Embeddable Iframe Player
│   ├── index.html / embed.js   # Zero-overhead embed player
│   └── style.css               # Compact responsive styling
│
├── docs/                       # Architectural and technical documentation
│   └── Architecture.md         # System architecture and dependency flow
│
├── libs/                       # Draco WebAssembly & JS decoders
├── metadata.json               # Application metadata
├── package.json                # Project configuration
└── server.js                   # Static development server
```

---

## Quick Start & Local Development

This project uses native ES modules with CDN import maps and requires **no build step, bundler, or compilation**.

### 1. Prerequisites
- Any modern web browser supporting WebGL 2 (Chrome, Firefox, Safari, Edge).
- A static HTTP/HTTPS web server. *(Browser security policies block ES modules when loaded via `file://`).*

### 2. Running Locally
Run the built-in development server:
```bash
npm start
```
Or use any standard static server:
```bash
npx serve .
# OR
python3 -m http.server 3000
```
Open `http://localhost:3000` in your browser to access the Hub, Editor, and Viewers.

---

## Hosting the Embed Viewer on Your Server

The `/Embed/` package is designed for easy deployment to any static host, CDN, or web server.

### 1. Sibling Directory Requirement
Because `/Embed/` imports the shared 3D engine from `/shared/`, **both folders must be deployed together as siblings**:

```text
your-web-root/
├── Embed/                      # Embed player files
│   ├── index.html              # HTML entry point for iframes
│   ├── embed.js
│   ├── style.css
│   └── ...
└── shared/                     # Shared 3D core engine
    ├── viewerCore.js
    ├── viewerLoader.js
    ├── viewerHUD.js
    ├── hotspotOverlay.js
    ├── CameraRig.js
    ├── schema.js
    └── ...
```

### 2. Static Hosting Quick Guides
- **Vercel / Netlify / Cloudflare Pages**: Deploy your repository root directory directly as a static site (leave build command empty, publish directory as `.`).
- **GitHub Pages**: Place `/Embed/` and `/shared/` in your repository root or `docs/` folder, and enable GitHub Pages in your repository settings.
- **Nginx / Apache / S3 + CloudFront**: Copy `/Embed/` and `/shared/` into your public HTML root.

### 3. Server MIME Types & CORS
Ensure your web server serves standard web assets with appropriate headers:
- `.js` / `.mjs` &rarr; `application/javascript`
- `.json` &rarr; `application/json`
- `.glb` / `.gltf` &rarr; `model/gltf-binary` or `application/octet-stream`
- `.wasm` &rarr; `application/wasm`

If your 3D models or JSON scene files are hosted on an external domain or CDN, enable CORS headers on the asset server:
```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
```

---

## Embedding the Viewer in a Webpage

Embed the 3D viewer into any website, CMS (WordPress, Shopify, Webflow), or web application using an `<iframe>`:

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
| `glb` | `model`, `gltf` | Absolute or relative URL to the `.glb` / `.gltf` 3D model | `?glb=/models/product.glb` |
| `json` | `scene` | Absolute or relative URL to the Schema v2 scene JSON document | `?json=/models/product.json` |
| `title` | &mdash; | Product or showcase title displayed in the HUD badge | `?title=Gaming+Headset` |
| `env` | `preset` | HDR lighting preset (`studio_small_09`, `potsdamer_platz`, `autumn_ground`, `aircraft_workshop`) | `?env=studio_small_09` |
| `turntable` | `autorotate` | Enable 360° turntable rotation on load (`1` or `true`) | `?turntable=1` |
| `speed` | &mdash; | Initial turntable rotation speed (`0.5x`, `1x`, `1.5x`, `2x`, `3x`) | `?speed=1.5x` |
| `bg` | `background` | Viewport background color in hex format | `?bg=%2318181c` |

---

## Bidirectional Integration API (`postMessage`)

The Embed viewer supports full two-way communication with the parent host page.

### 1. Sending Commands to the Viewer (Host &rarr; Iframe)

Send messages to the iframe using `iframeElement.contentWindow.postMessage(message, "*")`:

| Message Type | Payload Structure | Description |
| :--- | :--- | :--- |
| `RESET_CAMERA` | `{ type: "RESET_CAMERA" }` | Resets camera orientation and auto-frames the current model. |
| `TOGGLE_TURNTABLE` | `{ type: "TOGGLE_TURNTABLE", enabled?: boolean, speed?: string }` | Starts, stops, or toggles 360° turntable rotation. |
| `SET_SPEED` | `{ type: "SET_SPEED", speed: "1.5x" }` | Updates the turntable rotation speed multiplier. |
| `SET_ENVIRONMENT` | `{ type: "SET_ENVIRONMENT", preset: "potsdamer_platz" }` | Switches the HDR lighting preset. |
| `FLY_TO_HOTSPOT` | `{ type: "FLY_TO_HOTSPOT", index: 0 }` | Smoothly animates the camera to focus on a specific hotspot index. |
| `LOAD_MODEL` | `{ type: "LOAD_MODEL", url: "...", companionJson?: object }` | Dynamically swaps the 3D model without reloading the iframe. |
| `LOAD_SCENE` | `{ type: "LOAD_SCENE", json?: object, url?: string }` | Dynamically loads a new scene JSON configuration. |
| `SET_TITLE` | `{ type: "SET_TITLE", title: "New Title" }` | Updates the title displayed on the HUD badge. |

### 2. Listening for Viewer Events (Iframe &rarr; Host)

Listen for events sent from the viewer iframe in your host page:

```javascript
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case "3D_VIEWER_READY":
      console.log("3D Viewer loaded successfully:", data.modelName);
      break;

    case "HOTSPOT_BUTTON_CLICK":
      console.log("Hotspot button clicked:", data.hotspot);
      console.log("Action text:", data.action);
      console.log("Requested JS function:", data.functionName);
      // Example: Open a custom modal, trigger checkout, or track analytics
      break;

    case "SIMULATOR_TOGGLE":
      console.log("Simulator toggled:", data.active, "Model:", data.modelName);
      break;
  }
});
```

---

## Hotspot Scene JSON Schema v2 Reference

Hotspots support modular content sections. Each section can define its own description, bullet list items, and actionable buttons with optional custom JavaScript callback names:

```json
{
  "version": "2.0.0",
  "metadata": {
    "title": "Viper V4 Pro",
    "created": "2026-08-29T19:00:00.000Z",
    "generator": "3D App Viewer Editor"
  },
  "settings": {
    "background": "#18181c",
    "backgroundType": "color",
    "environment": {
      "preset": "studio_small_09",
      "intensity": 1.0,
      "rotation": 0
    },
    "bloom": {
      "enabled": false,
      "strength": 0.6,
      "radius": 0.4,
      "threshold": 0.85
    },
    "hotspots": {
      "titleFontSize": 14,
      "titleFontColor": "#ffffff",
      "descFontSize": 12.5,
      "descFontColor": "#e0e0e0",
      "listFontSize": 11,
      "listFontColor": "#cccccc",
      "panelColor": "rgba(24, 24, 28, 0.95)",
      "occlusionTolerance": 0.08
    },
    "line": {
      "style": "dashed",
      "color": "#44D62C",
      "width": 1.5
    }
  },
  "hotspots": [
    {
      "id": "hotspot_sensor",
      "title": "Focus Pro 35K Gen-2 Optical Sensor",
      "position": [0.0, 0.15, -0.05],
      "panelOffset": { "x": 220, "y": -90 },
      "color": "#44D62C",
      "sections": [
        {
          "description": "Next-generation optical precision with 1-DPI step adjustments.",
          "listItems": [
            "35,000 max DPI sensitivity",
            "750 IPS tracking speed",
            "99.8% resolution accuracy"
          ],
          "buttons": [
            {
              "enabled": true,
              "text": "View Technical Specs",
              "url": "https://example.com/specs",
              "jsFunction": "onViewSensorSpecs"
            }
          ]
        }
      ]
    }
  ],
  "lights": []
}
```

---

## Complete Parent Page Integration Example

Here is a complete, copy-paste integration example showing how to embed the viewer, control it with host UI buttons, and handle user interactions:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>3D Product Showcase Integration</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f0f12;
      color: #f1f1f3;
      margin: 0;
      padding: 24px;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
    }
    .viewer-frame {
      width: 100%;
      height: 580px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    }
    .controls {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    button {
      background: #1c1c22;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 10px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    button:hover {
      background: #282832;
      border-color: #44d62c;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>Interactive 3D Product Showcase</h2>
    
    <iframe
      id="productViewer"
      class="viewer-frame"
      src="/Embed/index.html?glb=/Viewer/assets/Products/Viper%20V4%20Pro.glb&json=/Viewer/assets/Products/Viper%20V4%20Pro.json&turntable=1&speed=1x&env=studio_small_09"
      allow="fullscreen; xr-spatial-tracking"
    ></iframe>

    <div class="controls">
      <button onclick="sendCommand({ type: 'RESET_CAMERA' })">Reset View</button>
      <button onclick="sendCommand({ type: 'TOGGLE_TURNTABLE' })">Toggle 360° Turntable</button>
      <button onclick="sendCommand({ type: 'SET_SPEED', speed: '2x' })">2x Rotation Speed</button>
      <button onclick="sendCommand({ type: 'FLY_TO_HOTSPOT', index: 0 })">Focus Hotspot #1</button>
      <button onclick="sendCommand({ type: 'SET_ENVIRONMENT', preset: 'potsdamer_platz' })">Outdoor Lighting</button>
    </div>
  </div>

  <script>
    const iframe = document.getElementById("productViewer");

    function sendCommand(message) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, "*");
      }
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "HOTSPOT_BUTTON_CLICK") {
        console.log("Hotspot clicked in host page:", event.data);
      }
    });
  </script>
</body>
</html>
```

---

## Troubleshooting & FAQ

1. **Model fails to load or shows a CORS error**:
   - Verify that your asset server returns `Access-Control-Allow-Origin: *`.
2. **ES Module 404 or "Failed to resolve module specifier"**:
   - Ensure `/shared/` is hosted alongside `/Embed/` in the same relative parent directory.
3. **Black screen when opening directly from local files (`file:///`)**:
   - Browsers block local module imports over the `file://` protocol. Use `npm start`, `npx serve`, or `python3 -m http.server`.
4. **Mixed content security warnings**:
   - If your main webpage is served over `https://`, all iframe `src` URLs and query parameter assets must also use `https://`.
