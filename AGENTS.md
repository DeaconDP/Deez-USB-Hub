# AGENTS.md — Deez USB Hub

## What this is

Windows-first Tauri 2 desktop app that maps USB controllers → hubs → ports (including empty ports) and shows granular device details. Not a PWA — browsers cannot see hub topology.

## Layout

- `src/` — React UI (three panes: Ports | Devices | Details)
- `src-tauri/src/usb/` — USB backend boundary
  - `model.rs` — shared serde types
  - `windows_hubs.rs` — SetupAPI + hub IOCTLs (Windows only)
  - `pnp.rs` — PnP friendly-name / driver enrichment
  - `watch.rs` — poll + emit `usb://topology-changed`
  - `mod.rs` — `UsbBackend` trait; non-Windows stub
- `ROADMAP.md` / `TODO.md` — plan state across sessions

## Conventions

- Diagnostics are read-only. The only mutation is a confirmed, policy-guarded
  single-port cycle; no eject, disable/enable, controller reset, or power policy.
- Error codes: `USB-001` enumerate fail, `USB-002` hub open denied, `USB-003` platform unsupported.
- Cyberpunk visual tokens in `src/App.css`; keep neon accents restrained.
- Prefer updating ROADMAP Deferred when skipping work.

## Run

- One-click: `run.bat` (Windows) / `run.command` (macOS/Linux) — npm install + `tauri dev`, single-instance via `.run/dev.pid`, Vite port **1420** (`strictPort`).
- Manual:

```bash
npm install
npm run tauri dev
```

Requires Rust, Node, and Windows WebView2.
