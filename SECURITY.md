# Security Policy

## Supported versions

This project is a local, read-only Windows desktop utility. Only the latest commit on `main` is supported.

## Reporting a vulnerability

Please report security issues privately — do not open a public GitHub issue for undisclosed vulnerabilities.

Email: **security@deac.online**

Include:

- A short description of the issue
- Steps to reproduce
- Affected OS / build if known
- Any suggested fix (optional)

You should receive an acknowledgment within a few days. Please give us a reasonable window to investigate and ship a fix before any public disclosure.

## Scope notes

- The app is intentionally **read-only** (no eject / disable / power policy in v1).
- It talks to the local Windows USB stack; it does not phone home and does not collect telemetry.
- Do not include secrets, personal device inventories, or full system dumps in reports unless they are required to demonstrate the issue — redact where possible.
