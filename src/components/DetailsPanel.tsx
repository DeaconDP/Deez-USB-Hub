import type { ReactNode } from "react";
import {
  deviceHasPnpProblem,
  deviceHealthLabel,
  deviceKind,
  devicePrimaryLabel,
  portFaultExplanation,
} from "../types/deviceKind";
import {
  classLabel,
  hexId,
  type UsbDevice,
  type UsbPort,
} from "../types/usb";

interface DetailsPanelProps {
  device: UsbDevice | null;
  faultPort: UsbPort | null;
  state: "loading" | "ready" | "error" | "empty";
  error: string | null;
}

export function DetailsPanel({
  device,
  faultPort,
  state,
  error,
}: DetailsPanelProps) {
  const subtitle = device
    ? devicePrimaryLabel(device)
    : faultPort
      ? `Port ${faultPort.portIndex} · ${faultPort.statusLabel}`
      : "Select a device";

  return (
    <section className="panel details-panel" aria-labelledby="details-heading">
      <header className="panel-header">
        <h2 id="details-heading">Details</h2>
        <p className="panel-sub">{subtitle}</p>
      </header>

      {state === "loading" && (
        <p className="panel-state" role="status">
          Loading topology…
        </p>
      )}
      {state === "error" && (
        <p className="panel-state panel-error" role="alert">
          {error ?? "Could not load details."}
        </p>
      )}
      {state !== "loading" && state !== "error" && !device && !faultPort && (
        <p className="panel-state">
          Pick a device in the center pane to inspect descriptors, interfaces,
          and PnP data.
        </p>
      )}

      {state !== "loading" && state !== "error" && !device && faultPort && (
        <div className="details-body">
          <DetailSection title="Port fault">
            <Dl
              rows={[
                ["Port", String(faultPort.portIndex)],
                ["Hub", faultPort.hubId],
                ["Status", faultPort.statusLabel],
                [
                  "What it means",
                  portFaultExplanation(faultPort.status, faultPort.statusLabel),
                ],
                ["Speed", faultPort.speed ?? "—"],
              ]}
            />
            <p className="fault-note" role="status">
              No device descriptors are available until the port enumerates
              successfully.
            </p>
          </DetailSection>
        </div>
      )}

      {device && (
        <div className="details-body">
          <DetailSection title="Identity">
            <Dl
              rows={[
                ["Kind", deviceKind(device).label],
                [
                  "Health",
                  deviceHealthLabel(
                    device,
                    faultPort &&
                      faultPort.hubId === device.hubId &&
                      faultPort.portIndex === device.portIndex
                      ? faultPort.status
                      : null,
                    faultPort?.statusLabel,
                  ),
                ],
                ["Name", devicePrimaryLabel(device)],
                ["VID:PID", `${hexId(device.vendorId)}:${hexId(device.productId)}`],
                [
                  "Revision",
                  device.revision != null
                    ? `0x${hexId(device.revision)}`
                    : "—",
                ],
                ["Manufacturer", device.manufacturer ?? "—"],
                ["Product", device.product ?? "—"],
                ["Serial", device.serial ?? "—"],
                ["Address", String(device.address)],
                [
                  "Class",
                  `0x${hexId(device.deviceClass, 2)} (${classLabel(device.deviceClass)})`,
                ],
                [
                  "Subclass / Protocol",
                  `0x${hexId(device.deviceSubclass, 2)} / 0x${hexId(device.deviceProtocol, 2)}`,
                ],
              ]}
            />
            {deviceHasPnpProblem(device) && (
              <p className="fault-note" role="status">
                Windows reports a PnP problem for this device
                {device.pnpProblemCode != null
                  ? ` (0x${device.pnpProblemCode.toString(16).toUpperCase()})`
                  : ""}
                . Check Device Manager for driver details.
              </p>
            )}
          </DetailSection>

          <DetailSection title="Location">
            <Dl
              rows={[
                ["Hub", device.hubId],
                ["Port", String(device.portIndex)],
                [
                  "Port chain",
                  device.portChain.length
                    ? device.portChain.join(" → ")
                    : String(device.portIndex),
                ],
                ["Speed", device.speed ?? "—"],
                [
                  "SuperSpeed capable",
                  device.superspeed == null
                    ? "—"
                    : device.superspeed
                      ? "Yes"
                      : "No",
                ],
                ["Connection", device.connectionStatus],
                ["Is hub", device.isHub ? "Yes" : "No"],
              ]}
            />
          </DetailSection>

          <DetailSection title="PnP / Driver">
            <Dl
              rows={[
                ["Friendly name", device.friendlyName ?? "—"],
                ["Instance ID", device.instanceId ?? "—"],
                ["Driver key", device.driverKey ?? "—"],
                ["Service", device.service ?? "—"],
                ["PnP status", device.pnpStatus ?? "—"],
                [
                  "PnP problem code",
                  device.pnpProblemCode != null
                    ? `0x${device.pnpProblemCode.toString(16).toUpperCase()}`
                    : "—",
                ],
                [
                  "Location paths",
                  device.locationPaths.length
                    ? device.locationPaths.join("\n")
                    : "—",
                ],
              ]}
            />
          </DetailSection>

          <DetailSection title="Configurations">
            {device.configurations.length === 0 ? (
              <p className="panel-state">No configuration descriptors returned.</p>
            ) : (
              device.configurations.map((cfg) => (
                <div key={cfg.value} className="config-block">
                  <h4>
                    Config {cfg.value} · {cfg.maxPowerMa} mA · attrs 0x
                    {hexId(cfg.attributes, 2)}
                  </h4>
                  {cfg.interfaces.map((iface) => (
                    <div
                      key={`${cfg.value}-${iface.interfaceNumber}-${iface.alternateSetting}`}
                      className="iface-block"
                    >
                      <h5>
                        Interface {iface.interfaceNumber}
                        {iface.alternateSetting > 0
                          ? ` alt ${iface.alternateSetting}`
                          : ""}{" "}
                        · {classLabel(iface.class)} · 0x
                        {hexId(iface.class, 2)}/
                        {hexId(iface.subclass, 2)}/
                        {hexId(iface.protocol, 2)}
                      </h5>
                      {iface.endpoints.length === 0 ? (
                        <p className="muted">No endpoints</p>
                      ) : (
                        <table className="ep-table">
                          <caption className="sr-only">
                            Endpoints for interface {iface.interfaceNumber}
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Addr</th>
                              <th scope="col">Dir</th>
                              <th scope="col">Type</th>
                              <th scope="col">Max pkt</th>
                              <th scope="col">Interval</th>
                            </tr>
                          </thead>
                          <tbody>
                            {iface.endpoints.map((ep) => (
                              <tr key={`${iface.interfaceNumber}-${ep.address}`}>
                                <td>0x{hexId(ep.address, 2)}</td>
                                <td>{ep.direction}</td>
                                <td>{ep.transferType}</td>
                                <td>{ep.maxPacketSize}</td>
                                <td>{ep.interval}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </DetailSection>

          <DetailSection title="Raw">
            <Dl
              rows={[
                ["Device ID", device.id],
                ["Max packet EP0", String(device.maxPacketSize0)],
                ["Num configurations", String(device.numConfigurations)],
                ["Container ID", device.containerId ?? "—"],
              ]}
            />
          </DetailSection>
        </div>
      )}
    </section>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="detail-dl">
      {rows.map(([k, v]) => (
        <div key={k} className="detail-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
