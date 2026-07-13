# Deez USB Hub

Windows-first desktop app that maps your USB topology — host controllers, hubs, **every port** (empty or occupied), and deep per-device details.

Built with **Tauri 2 + React + TypeScript**. The Rust side talks to the Windows USB stack via SetupAPI and hub IOCTLs.

Created by [deac.online](https://deac.online) @ [worldbuild.io](https://worldbuild.io)

## Prerequisites

- Windows 10/11
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- WebView2 (usually preinstalled on Windows 11)

## Run (one-click)

- **Windows:** double-click `run.bat`
- **macOS / Linux:** double-click `run.command` (or `chmod +x run.command && ./run.command`)

Installs npm deps if needed, then starts `tauri dev` (Vite on **http://localhost:1420**). Needs Node 20+, Rust, and WebView2 on Windows. A second launch stops the previous owned instance first.

## Develop

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## UI

| Pane | Role |
|------|------|
| **Ports** | Controllers → hubs → ports (empty ports shown) |
| **Devices** | Devices under the current selection |
| **Details** | VID/PID, strings, speed, interfaces, endpoints, PnP/driver |

Hotplug: the tree refreshes automatically when devices are plugged or unplugged. Use **Refresh** for a manual pass.

## Known gaps

- Verified on a live Windows machine: host controllers map with empty ports (e.g. root hub 24 ports / 19 empty) and nested external hubs appear under their parent.
- Some root/virtual hubs may still refuse IOCTLs; those controllers appear as **unmapped** with connected devices only (never a silent failure). Warnings use codes `USB-001` / `USB-002`.
- Companion USB 2.0 / 3.x port pairs can look like “extra” ports on the same physical connector — that is how Windows exposes them.
- String descriptors and endpoint tables depend on what the hub stack returns; composite devices may appear as multiple PnP nodes.
- macOS/Linux backends are not implemented yet (Windows-first).
- Read-only — no eject, disable, or power policy in v1.

## Error codes

| Code | Meaning |
|------|---------|
| `USB-001` | Topology enumeration failed |
| `USB-002` | Hub open denied or IOCTL failed |
| `USB-003` | Platform not supported |

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

[MIT](LICENSE)
