import type { KeyboardEvent, ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import {
  deviceKind,
  devicePrimaryLabel,
  isErrorPortStatus,
  isProblemPortStatus,
  portFaultExplanation,
} from "../types/deviceKind";
import {
  collectAllPorts,
  type Selection,
  type UsbController,
  type UsbDevice,
  type UsbHub,
  type UsbPort,
  type UsbTopology,
} from "../types/usb";

interface PortsPanelProps {
  topology: UsbTopology | null;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  state: "loading" | "ready" | "error" | "empty";
  error: string | null;
}

export function PortsPanel({
  topology,
  selection,
  onSelect,
  state,
  error,
}: PortsPanelProps) {
  const problemPorts =
    topology && state === "ready"
      ? collectAllPorts(topology).filter(
          (p) =>
            isProblemPortStatus(p.status) &&
            p.status !== "enumerating" &&
            p.status !== "reset",
        )
      : [];

  return (
    <section className="panel ports-panel" aria-labelledby="ports-heading">
      <header className="panel-header">
        <h2 id="ports-heading">Ports</h2>
        <p className="panel-sub">
          Controllers → hubs → ports
          {problemPorts.length > 0
            ? ` · ${problemPorts.length} problem${problemPorts.length === 1 ? "" : "s"}`
            : ""}
        </p>
      </header>

      {state === "loading" && (
        <p className="panel-state" role="status">
          Scanning USB topology…
        </p>
      )}
      {state === "error" && (
        <p className="panel-state panel-error" role="alert">
          {error ?? "Could not load ports."}
        </p>
      )}
      {state === "empty" && (
        <p className="panel-state">No USB controllers reported.</p>
      )}

      {topology && state === "ready" && problemPorts.length > 0 && (
        <ul className="problems-strip" aria-label="Port problems">
          {problemPorts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="problem-link"
                onClick={() =>
                  onSelect({
                    kind: "port",
                    id: p.id,
                    hubId: p.hubId,
                    portIndex: p.portIndex,
                  })
                }
              >
                <span className="problem-mark" aria-hidden="true">
                  {isErrorPortStatus(p.status) ? "!" : "△"}
                </span>
                Port {p.portIndex}: {p.statusLabel.toLowerCase()} —{" "}
                {portFaultExplanation(p.status, p.statusLabel)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {topology && state === "ready" && (
        <div className="tree" role="tree" aria-label="USB port tree">
          <TreeItem
            label="All devices"
            selected={selection.kind === "all"}
            onSelect={() => onSelect({ kind: "all" })}
            glyph="⌂"
          />
          {topology.controllers.map((ctrl) => (
            <ControllerNode
              key={ctrl.id}
              controller={ctrl}
              devices={topology.devices}
              selection={selection}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {topology && topology.warnings.length > 0 && (
        <ul className="warning-list" aria-label="Enumeration warnings">
          {topology.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`}>
              <span className="warn-code">{w.code}</span> {w.message}
              {w.target ? ` (${w.target})` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ControllerNode({
  controller,
  devices,
  selection,
  onSelect,
}: {
  controller: UsbController;
  devices: UsbDevice[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div className="tree-branch" role="group" aria-label={controller.name}>
      <TreeItem
        label={controller.name}
        meta={controller.mapped ? "Mapped" : "Unmapped"}
        selected={
          selection.kind === "controller" && selection.id === controller.id
        }
        onSelect={() => onSelect({ kind: "controller", id: controller.id })}
        glyph="◈"
        depth={1}
      />
      {controller.hubs.map((hub) => (
        <HubNode
          key={hub.id}
          hub={hub}
          devices={devices}
          selection={selection}
          onSelect={onSelect}
          depth={2}
        />
      ))}
    </div>
  );
}

function HubNode({
  hub,
  devices,
  selection,
  onSelect,
  depth,
}: {
  hub: UsbHub;
  devices: UsbDevice[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  depth: number;
}) {
  return (
    <div className="tree-branch" role="group" aria-label={hub.name}>
      <TreeItem
        label={hub.name}
        meta={`${hub.portCount} ports${hub.isRoot ? " · root" : ""}`}
        selected={selection.kind === "hub" && selection.id === hub.id}
        onSelect={() => onSelect({ kind: "hub", id: hub.id })}
        glyph="⬡"
        depth={depth}
      />
      {hub.ports.map((port) => (
        <PortNode
          key={port.id}
          port={port}
          devices={devices}
          selection={selection}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
      {hub.childHubs.map((child) => (
        <HubNode
          key={child.id}
          hub={child}
          devices={devices}
          selection={selection}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function PortNode({
  port,
  devices,
  selection,
  onSelect,
  depth,
}: {
  port: UsbPort;
  devices: UsbDevice[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  depth: number;
}) {
  const device =
    port.deviceId != null
      ? devices.find((d) => d.id === port.deviceId)
      : devices.find(
          (d) => d.hubId === port.hubId && d.portIndex === port.portIndex,
        );

  let label = `Port ${port.portIndex}`;
  let meta: string | undefined;
  let glyph: string | undefined;

  if (port.status === "empty") {
    label = `Port ${port.portIndex} · Empty`;
  } else if (isProblemPortStatus(port.status)) {
    label = `Port ${port.portIndex} · Fault`;
    meta = port.statusLabel;
    glyph = "⚠";
  } else if (device) {
    const kind = deviceKind(device);
    label = `Port ${port.portIndex} · ${devicePrimaryLabel(device)}`;
    meta = kind.label;
    glyph = kind.glyph;
  } else if (port.isHub) {
    meta = "Hub";
    glyph = "⬡";
  }

  const fault =
    isProblemPortStatus(port.status) &&
    port.status !== "enumerating" &&
    port.status !== "reset";

  return (
    <TreeItem
      label={label}
      meta={meta}
      selected={selection.kind === "port" && selection.id === port.id}
      onSelect={() =>
        onSelect({
          kind: "port",
          id: port.id,
          hubId: port.hubId,
          portIndex: port.portIndex,
        })
      }
      depth={depth}
      glyph={glyph}
      fault={fault}
      faultError={isErrorPortStatus(port.status)}
      badge={<StatusBadge status={port.status} label={port.statusLabel} />}
    />
  );
}

function TreeItem({
  label,
  meta,
  selected,
  onSelect,
  depth = 0,
  glyph,
  badge,
  fault,
  faultError,
}: {
  label: string;
  meta?: string;
  selected: boolean;
  onSelect: () => void;
  depth?: number;
  glyph?: string;
  badge?: ReactNode;
  fault?: boolean;
  faultError?: boolean;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  const faultClass = fault
    ? faultError
      ? " is-fault is-fault-error"
      : " is-fault is-fault-warn"
    : "";

  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={selected}
      className={`tree-item${selected ? " is-selected" : ""}${faultClass}`}
      style={{ paddingLeft: `${0.75 + depth * 0.85}rem` }}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span className="tree-item-main">
        {glyph && (
          <span className="tree-glyph" aria-hidden="true">
            {glyph}
          </span>
        )}
        <span className="tree-label">{label}</span>
        {meta && <span className="tree-meta">{meta}</span>}
      </span>
      {badge}
    </button>
  );
}
