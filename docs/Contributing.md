# Contributing

Thank you for improving 3D App Viewer. This project values focused, compatible changes over large rewrites. These rules apply to human contributors and AI coding agents.

## Before you start

1. Read [Architecture.md](Architecture.md), [JSON.md](JSON.md), and [../AI_GUIDELINES.md](../AI_GUIDELINES.md).
2. Run the Editor and Viewer through a local HTTP server.
3. Identify the owning module before changing code.
4. Keep the requested scope narrow; ask for clarification before making a breaking or broad architectural change.

## Engineering rules

- Preserve existing behavior unless the task explicitly changes it.
- Keep modules focused and give each module one clear responsibility.
- Avoid circular dependencies; never make feature modules depend on application bootstrap code.
- Do not duplicate functionality. Prefer extending an existing system when it is the natural owner.
- Keep Editor and Viewer compatible whenever their shared data contract changes.
- Never change the JSON schema without updating both applications, [JSON.md](JSON.md), and compatibility coverage.
- Use DOM-safe text APIs for user- or JSON-provided text; do not introduce unsafe HTML injection.
- Keep rendering, domain data, and UI concerns separated.
- Preserve model/JSON asset naming conventions and path casing.

## Testing expectations

Test after every feature or behavior change.

- Import a GLB in the Editor and confirm camera framing works.
- Create, select, move, edit, and delete a hotspot.
- Import and export JSON; verify the exported file can be imported again.
- Load the matching GLB and JSON in the Viewer; confirm markers, panels, lines, and occlusion behavior work.
- Check browser console output for errors.
- Run the repository's available lint, syntax, and test commands when they exist.

If a required runtime or test tool is unavailable, state that clearly in the handoff rather than claiming the check passed.

## Change and commit hygiene

- Keep commits focused and small.
- Do not mix formatting churn with a behavior change.
- Update documentation when public behavior, setup, module responsibilities, or JSON fields change.
- Do not commit generated assets, secrets, or unrelated local changes.
- Explain compatibility impact in the pull request or handoff.

## AI-specific collaboration

AI agents must inspect the relevant files before editing, respect existing worktree changes, and leave a concise summary of modified files and validation performed. They must ask before introducing breaking behavior, new dependencies, a redesigned UI, or a changed JSON contract.
