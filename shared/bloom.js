/**
 * Shared Bloom & Post-Processing Manager
 * Provides high-performance UnrealBloomPass + EffectComposer pipeline
 * for Editor, Viewer, and Embed views.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export function createBloomManager(arg1, arg2, arg3, arg4, arg5) {
  let renderer, scene, camera, width, height;
  if (arg1 && arg1.renderer) {
    renderer = arg1.renderer;
    scene = arg1.scene;
    camera = arg1.camera;
    width = arg1.width;
    height = arg1.height;
  } else {
    renderer = arg1;
    scene = arg2;
    camera = arg3;
    width = arg4;
    height = arg5;
  }
  const w = width || window.innerWidth || 300;
  const h = height || window.innerHeight || 150;

  // Configuration state with cinematic defaults
  const config = {
    enabled: false,
    strength: 0.6,
    radius: 0.4,
    threshold: 0.85
  };

  let composer = null;
  let renderPass = null;
  let bloomPass = null;
  let fxaaPass = null;
  let outputPass = null;

  function initComposer() {
    if (!renderer || !scene || !camera) return;

    try {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);
      
      // Multisampling render target to preserve 4x MSAA inside post-processing
      const renderTarget = new THREE.WebGLRenderTarget(w * pixelRatio, h * pixelRatio, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 4
      });

      composer = new EffectComposer(renderer, renderTarget);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);

      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const resolution = new THREE.Vector2(w, h);
      bloomPass = new UnrealBloomPass(resolution, config.strength, config.radius, config.threshold);
      bloomPass.enabled = config.enabled;
      composer.addPass(bloomPass);

      // Subpixel FXAA Anti-Aliasing pass to eliminate edge crawling & shimmering during model movement
      fxaaPass = new ShaderPass(FXAAShader);
      fxaaPass.material.uniforms["resolution"].value.x = 1 / (w * pixelRatio);
      fxaaPass.material.uniforms["resolution"].value.y = 1 / (h * pixelRatio);
      composer.addPass(fxaaPass);

      outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch (err) {
      console.warn("Failed to initialize Bloom EffectComposer:", err);
      composer = null;
    }
  }

  initComposer();

  function setSize(newWidth, newHeight) {
    if (newWidth <= 0 || newHeight <= 0) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.0);

    if (bloomPass && bloomPass.resolution) {
      bloomPass.resolution.set(newWidth, newHeight);
    }
    if (fxaaPass && fxaaPass.material && fxaaPass.material.uniforms["resolution"]) {
      fxaaPass.material.uniforms["resolution"].value.x = 1 / (newWidth * pixelRatio);
      fxaaPass.material.uniforms["resolution"].value.y = 1 / (newHeight * pixelRatio);
    }
    if (composer) {
      composer.setSize(newWidth, newHeight);
    }
  }

  function applySettings(newSettings = {}) {
    if (newSettings.enabled !== undefined) config.enabled = Boolean(newSettings.enabled);
    if (typeof newSettings.strength === "number") config.strength = newSettings.strength;
    if (typeof newSettings.radius === "number") config.radius = newSettings.radius;
    if (typeof newSettings.threshold === "number") config.threshold = newSettings.threshold;

    if (bloomPass) {
      bloomPass.enabled = config.enabled;
      bloomPass.strength = config.strength;
      bloomPass.radius = config.radius;
      bloomPass.threshold = config.threshold;
    }
  }

  function setEnabled(enabled) {
    config.enabled = Boolean(enabled);
    if (bloomPass) {
      bloomPass.enabled = config.enabled;
    }
  }

  function setStrength(val) {
    config.strength = Number(val);
    if (bloomPass) bloomPass.strength = config.strength;
  }

  function setRadius(val) {
    config.radius = Number(val);
    if (bloomPass) bloomPass.radius = config.radius;
  }

  function setThreshold(val) {
    config.threshold = Number(val);
    if (bloomPass) bloomPass.threshold = config.threshold;
  }

  function render(currentScene, currentCamera) {
    if (config.enabled && composer) {
      if (renderPass) {
        if (currentScene) renderPass.scene = currentScene;
        if (currentCamera) renderPass.camera = currentCamera;
      }
      composer.render();
    } else if (renderer && (currentScene || scene) && (currentCamera || camera)) {
      renderer.render(currentScene || scene, currentCamera || camera);
    }
  }

  function dispose() {
    if (composer) {
      composer.dispose?.();
      composer = null;
    }
  }

  return {
    composer,
    bloomPass,
    renderPass,
    config,
    setSize,
    applySettings,
    setEnabled,
    setStrength,
    setRadius,
    setThreshold,
    render,
    dispose,
    isEnabled: () => config.enabled,
    getSettings: () => ({ ...config })
  };
}
