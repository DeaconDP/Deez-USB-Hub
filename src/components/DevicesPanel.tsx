import {
  deviceHasPnpProblem,
  deviceKind,
  devicePrimaryLabel,
  faultKind,
  isErrorPortStatus,
  isProblemPortStatus,
  isWarnPortStatus,
  portFaultExplanation,
} from "../types/deviceKind";
import {
  devicesForSelection,
  findPort,
  hexId,
  portsForSelection,
  type Selection,
  type UsbDevice,
  type UsbPort,
  type UsbTopology,
} from "../types/usb";

interface DevicesPanelProps {
  topology: UsbTopology | null;
  selection: Selection;
  selectedDeviceId: string | null;
  selectedFaultPortId: string | null;
  onSelectDevice: (id: string) => void;
  onSelectFault: (port: UsbPort) => void;
  state: "loading" | "ready" | "error" | "empty";
  error: string | null;
}

type ListRow =
  | { kind: "device"; device: UsbDevice; port: UsbPort | null }
  | { kind: "fault"; port: UsbPort };

export function DevicesPanel({
  topology,
  selection,
  selectedDeviceId,
  selectedFaultPortId,
  onSelectDevice,
  onSelectFault,
  state,
  error,
}: DevicesPanelProps) {
  const rows: ListRow[] =
    topology && state === "ready" ? buildRows(topology, selection) : [];

  return (
    <section className="panel devices-panel" aria-labelledby="devices-heading">
      <header className="panel-header">
        <h2 id="devices-heading">Devices</h2>
        <p className="panel-sub">
          {state === "ready"
            ? `${rows.length} under current selection`
            : "Connected USB devices"}
        </p>
      </header>

      {state === "loading" && (
        <p className="panel-state" role="status">
          Loading devices…
        </p>
      )}
      {state === "error" && (
        <p className="panel-state panel-error" role="alert">
          {error ?? "Could not load devices."}
        </p>
      )}
      {state === "empty" && (
        <p className="panel-state">No devices found on this system.</p>
      )}
      {state === "ready" && rows.length === 0 && (
        <p className="panel-state">
          No devices on this port or hub. Empty ports still appear in Ports.
        </p>
      )}

      {state === "ready" && rows.length > 0 && (
        <ul className="device-list" aria-label="USB devices">
          {rows.map((row) =>
            row.kind === "device" ? (
              <li key={row.device.id}>
                <DeviceRow
                  device={row.device}
                  port={row.port}
                  selected={selectedDeviceId === row.device.id}
                  onSelect={() => onSelectDevice(row.device.id)}
                />
              </li>
            ) : (
              <li key={`fault-${row.port.id}`}>
                <FaultRow
                  port={row.port}
                  selected={selectedFaultPortId === row.port.id}
                  onSelect={() => onSelectFault(row.port)}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function buildRows(topology: UsbTopology, selection: Selection): ListRow[] {
  const ports = portsForSelection(topology, selection);
  const problemPorts = ports.filter(
    (p) =>
      isProblemPortStatus(p.status) &&
      p.status !== "enumerating" &&
      p.status !== "reset",
  );

  const scopedDevices = devicesForSelection(topology, selection);

  const rows: ListRow[] = [
    ...problemPorts.map((port): ListRow => ({ kind: "fault", port })),
    ...scopedDevices.map((device): ListRow => ({
      kind: "device",
      device,
      port: findPort(topology, device.hubId, device.portIndex),
    })),
  ];

  rows.sort((a, b) => {
    const aFault = rowIsProblem(a);
    const bFault = rowIsProblem(b);
    if (aFault !== bFault) return aFault ? -1 : 1;
    return rowLabel(a).localeCompare(rowLabel(b), undefined, {
      sensitivity: "base",
    });
  });

  return rows;
}

function rowIsProblem(row: ListRow): boolean {
  if (row.kind === "fault") return true;
  if (deviceHasPnpProblem(row.device)) return true;
  if (row.port && isProblemPortStatus(row.port.status)) return true;
  return false;
}

function rowLabel(row: ListRow): string {
  if (row.kind === "fault") return row.port.statusLabel;
  return devicePrimaryLabel(row.device);
}

function DeviceRow({
  device,
  port,
  selected,
  onSelect,
}: {
  device: UsbDevice;
  port: UsbPort | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = deviceKind(device);
  const pnpProblem = deviceHasPnpProblem(device);
  const portProblem = port ? isProblemPortStatus(port.status) : false;
  const hasFault = pnpProblem || portProblem;
  const faultClass = port && isErrorPortStatus(port.status)
    ? "is-fault-error"
    : hasFault
      ? "is-fault-warn"
      : "";

  return (
    <button
      type="button"
      className={`device-row${selected ? " is-selected" : ""}${hasFault ? ` is-fault ${faultClass}` : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="device-row-top">
        <span className="kind-glyph" aria-hidden="true">
          {kind.glyph}
        </span>
        <span className="device-name">{devicePrimaryLabel(device)}</span>
        <span className="kind-chip">{kind.label}</span>
        {hasFault && (
          <span
            className={`fault-chip ${port && isErrorPortStatus(port.status) ? "fault-error" : "fault-warn"}`}
          >
            {pnpProblem ? "PnP problem" : port?.statusLabel ?? "Fault"}
          </span>
        )}
      </span>
      <span className="device-ids">
        {hexId(device.vendorId)}:{hexId(device.productId)}
      </span>
      <span className="device-meta">
        Port {device.portChain.join(" → ") || device.portIndex}
        {device.speed ? ` · ${device.speed}` : ""}
      </span>
    </button>
  );
}

function FaultRow({
  port,
  selected,
  onSelect,
}: {
  port: UsbPort;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = faultKind();
  const severity = isErrorPortStatus(port.status)
    ? "is-fault-error"
    : isWarnPortStatus(port.status)
      ? "is-fault-warn"
      : "is-fault-warn";

  return (
    <button
      type="button"
      className={`device-row is-fault ${severity}${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="device-row-top">
        <span className="kind-glyph" aria-hidden="true">
          {kind.glyph}
        </span>
        <span className="device-name">
          Port {port.portIndex} · {port.statusLabel}
        </span>
        <span className="kind-chip">{kind.label}</span>
        <span
          className={`fault-chip ${isErrorPortStatus(port.status) ? "fault-error" : "fault-warn"}`}
        >
          {port.statusLabel}
        </span>
      </span>
      <span className="device-meta">
        {portFaultExplanation(port.status, port.statusLabel)}
      </span>
    </button>
  );
}
