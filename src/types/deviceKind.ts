import { hexId, type PortStatus, type UsbDevice, type UsbInterface } from "./usb";

export type DeviceKindId =
  | "mouse"
  | "keyboard"
  | "hub"
  | "storage"
  | "audio"
  | "camera"
  | "hid"
  | "wireless"
  | "flipper"
  | "smartglasses"
  | "fan"
  | "printer"
  | "composite"
  | "cdc"
  | "vendor"
  | "fault"
  | "unknown";

export interface DeviceKind {
  id: DeviceKindId;
  label: string;
  /** Compact glyph for list/tree rows (aria-hidden). */
  glyph: string;
}

/** Curated VID:PID → kind nicknames (extend as needed). */
const KNOWN_VID_PID: Record<string, DeviceKindId> = {
  // Flipper Zero (STM32 DFU / CDC variants commonly seen)
  "0483:5740": "flipper",
  "0483:DF11": "flipper",
};

const KIND_META: Record<DeviceKindId, Omit<DeviceKind, "id">> = {
  mouse: { label: "Mouse", glyph: "⌖" },
  keyboard: { label: "Keyboard", glyph: "⌨" },
  hub: { label: "USB hub", glyph: "⬡" },
  storage: { label: "Storage", glyph: "▣" },
  audio: { label: "Audio", glyph: "♫" },
  camera: { label: "Camera", glyph: "◎" },
  hid: { label: "HID", glyph: "◇" },
  wireless: { label: "Wireless", glyph: "≋" },
  flipper: { label: "Flipper", glyph: "▲" },
  smartglasses: { label: "Smartglasses", glyph: "◈" },
  fan: { label: "Fan", glyph: "✸" },
  printer: { label: "Printer", glyph: "▦" },
  composite: { label: "Composite", glyph: "⧉" },
  cdc: { label: "Serial / CDC", glyph: "⇄" },
  vendor: { label: "Vendor device", glyph: "◆" },
  fault: { label: "Fault", glyph: "⚠" },
  unknown: { label: "USB device", glyph: "○" },
};

function kindOf(id: DeviceKindId): DeviceKind {
  return { id, ...KIND_META[id] };
}

function textBlob(d: UsbDevice): string {
  return [d.friendlyName, d.product, d.manufacturer, d.service]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchNameKind(blob: string): DeviceKindId | null {
  if (/flipper/.test(blob)) return "flipper";
  if (
    /smart\s*glass|smartglass|xreal|viture|rokid|even\s*realit|meta\s*ray|ray-?ban|nreal|glasses/.test(
      blob,
    )
  ) {
    return "smartglasses";
  }
  if (/\bfan\b|cooler|cooling\s*pad|notebook\s*cooler/.test(blob)) return "fan";
  if (
    /\bhdd\b|\bssd\b|hard\s*disk|external\s*(drive|disk|hdd|ssd)|mass\s*storage|usb\s*disk|flash\s*drive|thumb\s*drive/.test(
      blob,
    )
  ) {
    return "storage";
  }
  if (/\bmouse\b|trackball|touchpad|pointing/.test(blob)) return "mouse";
  if (/\bkeyboard\b|keypad/.test(blob)) return "keyboard";
  if (/\bhub\b/.test(blob)) return "hub";
  if (/\bwebcam\b|camera|uvc/.test(blob)) return "camera";
  if (/\bheadset\b|microphone|speaker|audio/.test(blob)) return "audio";
  if (/\bprinter\b/.test(blob)) return "printer";
  return null;
}

function classToKind(classCode: number): DeviceKindId | null {
  switch (classCode) {
    case 0x01:
      return "audio";
    case 0x02:
      return "cdc";
    case 0x03:
      return "hid";
    case 0x07:
      return "printer";
    case 0x08:
      return "storage";
    case 0x09:
      return "hub";
    case 0x0e:
      return "camera";
    case 0x10:
      return "audio";
    case 0xe0:
      return "wireless";
    case 0xff:
      return "vendor";
    default:
      return null;
  }
}

/** HID boot interface: subclass 1, protocol 1 = keyboard, 2 = mouse. */
function hidBootKind(iface: UsbInterface): DeviceKindId | null {
  if (iface.class !== 0x03) return null;
  if (iface.subclass !== 0x01) return null;
  if (iface.protocol === 1) return "keyboard";
  if (iface.protocol === 2) return "mouse";
  return null;
}

function interfaceKinds(d: UsbDevice): DeviceKindId[] {
  const kinds: DeviceKindId[] = [];
  for (const cfg of d.configurations) {
    for (const iface of cfg.interfaces) {
      const boot = hidBootKind(iface);
      if (boot) {
        kinds.push(boot);
        continue;
      }
      const fromClass = classToKind(iface.class);
      if (fromClass && fromClass !== "hid") {
        kinds.push(fromClass);
      } else if (fromClass === "hid") {
        kinds.push("hid");
      }
    }
  }
  return kinds;
}

/**
 * Resolve a human-facing device kind for skim-level UI.
 * Priority: curated VID/PID → name heuristics → hub flag → device class → interfaces → fallback.
 */
export function deviceKind(d: UsbDevice): DeviceKind {
  const vp = `${hexId(d.vendorId)}:${hexId(d.productId)}`;
  const known = KNOWN_VID_PID[vp];
  if (known) return kindOf(known);

  const named = matchNameKind(textBlob(d));
  if (named) return kindOf(named);

  if (d.isHub || d.deviceClass === 0x09) return kindOf("hub");

  if (d.deviceClass !== 0x00) {
    const fromDev = classToKind(d.deviceClass);
    if (fromDev === "hid") {
      // Prefer boot protocol from interfaces when present
      const ifaces = interfaceKinds(d);
      if (ifaces.includes("keyboard")) return kindOf("keyboard");
      if (ifaces.includes("mouse")) return kindOf("mouse");
      return kindOf("hid");
    }
    if (fromDev) return kindOf(fromDev);
  }

  const ifaces = interfaceKinds(d);
  if (ifaces.includes("keyboard") && ifaces.includes("mouse")) {
    return kindOf("composite");
  }
  if (ifaces.includes("keyboard")) return kindOf("keyboard");
  if (ifaces.includes("mouse")) return kindOf("mouse");
  if (ifaces.includes("storage")) return kindOf("storage");
  if (ifaces.includes("camera")) return kindOf("camera");
  if (ifaces.includes("audio")) return kindOf("audio");
  if (ifaces.includes("hub")) return kindOf("hub");
  if (ifaces.includes("cdc")) return kindOf("cdc");
  if (ifaces.includes("wireless")) return kindOf("wireless");
  if (ifaces.includes("printer")) return kindOf("printer");

  const unique = [...new Set(ifaces.filter((k) => k !== "hid"))];
  if (unique.length > 1) return kindOf("composite");
  if (ifaces.includes("hid")) return kindOf("hid");
  if (unique.length === 1) return kindOf(unique[0]);

  return kindOf("unknown");
}

/** Display name preferring Windows/PnP strings, then product, then kind + VID:PID. */
export function devicePrimaryLabel(d: UsbDevice): string {
  if (d.friendlyName?.trim()) return d.friendlyName.trim();
  if (d.product?.trim()) return d.product.trim();
  const kind = deviceKind(d);
  return `${kind.label} (${hexId(d.vendorId)}:${hexId(d.productId)})`;
}

export function faultKind(): DeviceKind {
  return kindOf("fault");
}

const HEALTHY_PORT: PortStatus[] = ["empty", "connected"];

export function isProblemPortStatus(status: PortStatus): boolean {
  return !HEALTHY_PORT.includes(status);
}

export function isErrorPortStatus(status: PortStatus): boolean {
  return (
    status === "failedEnumeration" ||
    status === "generalFailure" ||
    status === "overcurrent"
  );
}

export function isWarnPortStatus(status: PortStatus): boolean {
  return (
    status === "notEnoughPower" ||
    status === "notEnoughBandwidth" ||
    status === "hubNestedTooDeeply" ||
    status === "inLegacyHub" ||
    status === "unknown" ||
    status === "unmapped"
  );
}

/** Plain-language explanation for a port fault status. */
export function portFaultExplanation(status: PortStatus, label: string): string {
  switch (status) {
    case "failedEnumeration":
      return "Device failed to enumerate — it may be faulty, need more power, or a bad cable.";
    case "generalFailure":
      return "General USB failure on this port — try another port or cable.";
    case "overcurrent":
      return "Overcurrent — the device may be drawing too much power or shorted.";
    case "notEnoughPower":
      return "Not enough power available on this hub for the device.";
    case "notEnoughBandwidth":
      return "Not enough USB bandwidth for this device on this hub.";
    case "hubNestedTooDeeply":
      return "Hub chain is nested too deeply for Windows to map.";
    case "inLegacyHub":
      return "Device is behind a legacy hub with limited capabilities.";
    case "enumerating":
      return "Device is still enumerating.";
    case "reset":
      return "Port is resetting.";
    case "unknown":
      return "Port status could not be read.";
    case "unmapped":
      return "Controller or hub could not be opened for mapping.";
    default:
      return label;
  }
}

export function deviceHasPnpProblem(d: UsbDevice): boolean {
  return d.pnpProblemCode != null && d.pnpProblemCode !== 0;
}

export function deviceHealthLabel(
  d: UsbDevice,
  portStatus?: PortStatus | null,
  portLabel?: string | null,
): string {
  if (portStatus && isProblemPortStatus(portStatus)) {
    return `Port fault — ${portFaultExplanation(portStatus, portLabel ?? portStatus)}`;
  }
  if (deviceHasPnpProblem(d)) {
    return d.pnpStatus ?? `PnP problem 0x${d.pnpProblemCode!.toString(16)}`;
  }
  if (d.connectionStatus) return d.connectionStatus;
  return "Connected";
}
