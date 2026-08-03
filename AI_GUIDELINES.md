**AI Instruction**

Before making any code changes, read this document completely. If any requested change conflicts with these guidelines, explain the conflict and ask for clarification before proceeding.

# AI Engineering Guidelines

This is the authoritative engineering guide for AI coding assistants working in this repository. Read it before proposing or making code changes.

## Project Purpose

This project is a professional Three.js-based platform for authoring and presenting interactive 3D experiences. It consists of two applications:

| Application | Purpose |
| --- | --- |
| **Editor** | The authoring tool used to prepare scene and product experience data. |
| **Viewer** | The runtime application used to present authored experiences. |

The Viewer consumes data produced by the Editor. These applications share one data model and must always remain compatible.

## Core Philosophy

- Choose maintainability over shortcuts.
- Choose readability over cleverness.
- Preserve existing behavior unless explicitly instructed otherwise.
- Extend working systems instead of replacing them.
- Prefer incremental improvements to broad rewrites.
- Minimize technical debt rather than moving it elsewhere.
- Avoid unnecessary complexity and speculative abstractions.
- Ensure every change improves the project in a clear, supportable way.

## AI Responsibilities

Before making changes, an AI assistant must:

1. Read the project structure.
2. Understand the affected modules and their responsibilities.
3. Check the existing architecture and data flow.
4. Identify direct and indirect dependencies.
5. Propose a focused change with compatibility implications.
6. Wait for approval before major architectural changes, breaking changes, or broad rewrites.

Do not rewrite large areas of the application without a specific justification and explicit approval. Do not continue into additional features once the approved task is complete.

## Architecture Rules

Each module must have a single, clear responsibility. Keep dependencies directed from application coordination toward focused feature modules and stable primitives.

| Area | Responsibility |
| --- | --- |
| **Editor** | Authoring workflow and editing interactions. |
| **Viewer** | Runtime presentation of authored data. |
| **Shared** *(future)* | Stable cross-application primitives only; shared code must not blur Editor and Viewer responsibilities. |
| **State** | Centralized application state and controlled state access. |
| **Render** | Three.js scene setup, rendering lifecycle, camera, and render-loop concerns. |
| **Hotspots** | Annotation data, placement, editing, projection, and presentation behavior. |
| **Lights** | Light data and light-authoring behavior. |
| **Selection** | Selecting, deselecting, and representing the active editable object. |
| **UI** | Interface behavior and presentation that is not owned by a scene feature. |
| **IO** | Import, export, validation, and persistence boundaries. |
| **Utils** | Small, reusable, dependency-light helpers; never a dumping ground for unrelated logic. |
| **Bootstrap** | Application startup and coordination; it must not become a feature implementation module. |

Rules:

- Do not duplicate functionality across modules.
- Do not create circular dependencies.
- Do not bypass an existing system with a parallel implementation.
- Keep feature code out of bootstrap code whenever a focused module can own it.
- Create a new module only when it establishes a durable boundary, not merely to move lines of code.

## State Management

Use a centralized state model for shared application state.

- Avoid scattered globals.
- Use the centralized state module rather than creating competing state systems.
- Keep state changes predictable, explicit, and close to the behavior that owns them.
- Do not store the same concept in multiple independent forms.
- Keep transient UI state separate from durable, serializable scene data where possible.

## Editor and Viewer Compatibility

The Editor and Viewer are two applications sharing one data model.

- Never modify the JSON schema without updating both applications and their documentation.
- Preserve backward compatibility whenever possible.
- If a breaking change is necessary, propose a versioning and migration strategy before implementation.
- Treat asset naming, paths, and loading conventions as compatibility boundaries.
- Verify authored data in the Viewer after changes that affect Editor output.

## JSON Rules

The JSON format is part of the public API.

- Changing it requires careful consideration and explicit compatibility review.
- Do not silently add requirements that older documents cannot satisfy.
- Document every supported field and its ownership.
- Introduce versioning when breaking changes become necessary.
- Keep import, export, and runtime handling synchronized.

## UI Rules

- Do not redesign the interface unless explicitly requested.
- Preserve keyboard shortcuts and established workflows.
- Improve usability without surprising existing users.
- Keep layout and visual styling separate from domain and rendering logic.
- Prefer small, discoverable interaction improvements over disruptive changes.

## Three.js Rules

- Prefer efficient rendering and centralized rendering code.
- Dispose unused Three.js resources as part of their lifecycle.
- Avoid unnecessary allocations inside animation loops.
- Reuse vectors, materials, geometries, and other objects when practical.
- Keep scene mutation intentional and traceable.
- Do not add rendering features that bypass the established rendering lifecycle.

## Performance Rules

- Avoid unnecessary object creation every frame.
- Avoid duplicate event listeners and ensure listeners have a clear lifecycle.
- Prevent memory leaks, including abandoned DOM, GPU, and object-URL resources.
- Reuse objects where practical.
- Profile before optimizing; do not trade clarity for unmeasured micro-optimizations.

## Coding Standards

- Give every function one responsibility.
- Prefer descriptive names over abbreviations or implicit behavior.
- Prefer composition over large monolithic functions.
- Avoid deeply nested logic; use early returns and focused helpers.
- Keep modules cohesive and files reasonably sized.
- Preserve established formatting in files you touch; avoid unrelated formatting churn.
- Use safe DOM APIs for data supplied by users or imported documents.

## Refactoring Rules

When refactoring:

- Do not change behavior unless the task explicitly requires it.
- Do not change exported APIs without approval.
- Do not silently remove features or reduce supported data.
- Keep commits focused and small.
- Refactor incrementally, validating at each step.
- Separate cleanup from feature work when possible so compatibility impact remains clear.

## Future Features

The architecture is intentionally preparing for the following capabilities:

- Blender-style Transform Controls
- Scene Hierarchy
- Generic Inspector
- Multiple Cameras
- Multiple Light Types
- Scene Settings
- Undo/Redo
- Shared Modules
- Plugin System

New systems must integrate with the existing architecture, state model, and data contract rather than bypassing them with parallel mechanisms.

## AI Workflow

```text
Analyze
  ↓
Plan
  ↓
Implement
  ↓
Self-review
  ↓
Run project if possible
  ↓
Fix issues
  ↓
Summarize changes
```

Never continue implementing additional features without explicit approval.

## Pull Request Checklist

- [ ] Existing functionality preserved
- [ ] No duplicated code introduced
- [ ] No circular dependencies introduced
- [ ] JSON compatibility maintained
- [ ] Viewer compatibility maintained
- [ ] Imports cleaned
- [ ] Dead code removed
- [ ] Documentation updated
- [ ] Performance considered
- [ ] Code reviewed

## Final Principle

This project prioritizes long-term maintainability over short-term convenience. Every change should make the project easier to understand, easier to extend, and safer to modify.
