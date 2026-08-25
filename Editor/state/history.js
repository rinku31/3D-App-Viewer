import { state } from "./state.js";
import { importJsonData, exportJson } from "../io/io.js";
import { CURRENT_SCHEMA_VERSION, createDefaultSceneDocument } from "../io/schema.js";

const undoStack = [];
const redoStack = [];
let isProcessingHistory = false;
let debounceTimer = null;

// We need serializeSceneDocument, let's expose it from io.js or implement here.
// But importing serializeSceneDocument from io.js is easier. We will export it from io.js.
import { serializeSceneDocument } from "../io/io.js";

export function pushHistoryState() {
  if (isProcessingHistory) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const snap = JSON.stringify(serializeSceneDocument());
    
    if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snap) {
      undoStack.push(snap);
      redoStack.length = 0; // Clear redo
      if (undoStack.length > 50) {
        undoStack.shift(); // Limit history to 50
      }
    }
  }, 300);
}

export async function undo() {
  if (isProcessingHistory || undoStack.length <= 1) return; // Need at least 2 states (current + previous)
  
  isProcessingHistory = true;
  try {
    const currentState = undoStack.pop();
    redoStack.push(currentState);
    
    const previousState = undoStack[undoStack.length - 1];
    await importJsonData(JSON.parse(previousState), state.importedJsonFileName);
  } finally {
    isProcessingHistory = false;
  }
}

export async function redo() {
  if (isProcessingHistory || redoStack.length === 0) return;
  
  isProcessingHistory = true;
  try {
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    await importJsonData(JSON.parse(nextState), state.importedJsonFileName);
  } finally {
    isProcessingHistory = false;
  }
}

// Initial snapshot on load
export function initHistory() {
  setTimeout(pushHistoryState, 500); // Give scene time to load
}
