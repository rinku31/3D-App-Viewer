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

export function createBloomManager({ renderer, scene, camera, width, height }) {
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
  let outputPass = null;

  function initComposer() {
    if (!renderer || !scene || !camera) return;

    try {
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
      composer.setSize(w, h);

      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const resolution = new THREE.Vector2(w, h);
      bloomPass = new UnrealBloomPass(resolution, config.strength, config.radius, config.threshold);
      bloomPass.enabled = config.enabled;
      composer.addPass(bloomPass);

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
    if (bloomPass && bloomPass.resolution) {
      bloomPass.resolution.set(newWidth, newHeight);
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
