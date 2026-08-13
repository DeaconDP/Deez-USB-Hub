# Deez USB Hub

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/DeaconDP/Deez-USB-Hub@9cbddf6464da392b1de35a83970baff8a5b3e817/docs/screenshots/hero.png" alt="Deez USB Hub" width="720" />
</p>

Windows-first Tauri app that maps USB controllers, hubs, and every port — empty or occupied — with deep device details.

![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Platform: Windows-first](https://img.shields.io/badge/platform-Windows-first-informational)

## Who it’s for

Anyone debugging docks, hubs, and mystery USB devices who wants a topology map instead of Device Manager sprawl.

## Quick start

**Requires** Node.js, Rust, Windows WebView2 (Windows-first).

```bash
npm install
npm run tauri:dev
```

Or use project `run.bat` / `run.command` if present.

## Features

- Host controllers → hubs → ports (including empty)
- Per-device details for occupied ports
- Desktop Tauri shell

## Limitations

- Windows-first; other platforms may be limited
- Needs native permissions to enumerate USB

## Development

Vite default for Tauri webview is port **1420** in-repo.

## Credit

Created by [deac.online](https://deac.online) @ [worldbuild.io](https://worldbuild.io)

## License

MIT — see [LICENSE](LICENSE).
