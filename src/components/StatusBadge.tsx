import type { PortStatus } from "../types/usb";

const STATUS_CLASS: Record<PortStatus, string> = {
  empty: "status-empty",
  connected: "status-connected",
  failedEnumeration: "status-error",
  generalFailure: "status-error",
  overcurrent: "status-error",
  notEnoughPower: "status-warn",
  notEnoughBandwidth: "status-warn",
  hubNestedTooDeeply: "status-warn",
  inLegacyHub: "status-warn",
  enumerating: "status-busy",
  reset: "status-busy",
  unknown: "status-unknown",
  unmapped: "status-unknown",
};

export function StatusBadge({
  status,
  label,
}: {
  status: PortStatus;
  label: string;
}) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status] ?? "status-unknown"}`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{label}</span>
    </span>
  );
}
