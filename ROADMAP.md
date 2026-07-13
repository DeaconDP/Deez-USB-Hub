# Deez USB Hub — Roadmap

## Epics

- [x] **E1 — Windows USB topology** — Full port map via hub IOCTLs (empty + occupied + error states), PnP enrichment, live hotplug.
- [x] **E2 — Three-pane dashboard** — Ports tree, devices list, deep device details; loading/empty/error/success on every pane.
- [x] **E3 — Ship hygiene** — README known gaps, AGENTS orientation, structured error codes, no telemetry.
- [x] **E4 — Human-readable kinds + fault highlights** — Device kind chips (mouse/keyboard/hub/storage/Flipper/…), Ports show connected names, problems strip + synthetic fault rows, real PnP problem codes.

## Deferred

- 2026-07-13: Eject / disable / power policy deferred — v1 is read-only monitor. `src-tauri/src/usb/mod.rs:1`
- 2026-07-13: macOS/Linux port-map backends deferred — Windows-first; `UsbBackend` trait reserved. `src-tauri/src/usb/mod.rs:11`
- 2026-07-13: MSI installer packaging beyond Tauri defaults deferred — not needed for first usable build. `src-tauri/tauri.conf.json:1`
- 2026-07-13: WebUSB / browser-only mode deferred — cannot expose hub topology or empty ports. `AGENTS.md:1`
- 2026-07-13: Full USB-IF / vendor ID name database deferred — curated VID:PID + class/interface heuristics cover skim recognition for now. `src/types/deviceKind.ts:1`
- 2026-07-13: Per-brand icon packs beyond kind glyphs deferred — Unicode glyphs + chips are enough for E4. `src/types/deviceKind.ts:36`
