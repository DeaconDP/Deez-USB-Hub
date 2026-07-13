import { useEffect, useMemo, useState } from "react";
import { DevicesPanel } from "./components/DevicesPanel";
import { DetailsPanel } from "./components/DetailsPanel";
import { PortsPanel } from "./components/PortsPanel";
import { useUsbTopology } from "./hooks/useUsbTopology";
import { isProblemPortStatus } from "./types/deviceKind";
import {
  findPort,
  findPortById,
  type Selection,
  type UsbPort,
} from "./types/usb";
import "./App.css";

type MobileTab = "ports" | "devices" | "details";

function App() {
  const { topology, state, error, refreshing, refresh } = useUsbTopology();
  const [selection, setSelection] = useState<Selection>({ kind: "all" });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedFaultPortId, setSelectedFaultPortId] = useState<string | null>(
    null,
  );
  const [mobileTab, setMobileTab] = useState<MobileTab>("ports");

  const selectedDevice = useMemo(() => {
    if (!topology || !selectedDeviceId) return null;
    return topology.devices.find((d) => d.id === selectedDeviceId) ?? null;
  }, [topology, selectedDeviceId]);

  const faultPort: UsbPort | null = useMemo(() => {
    if (!topology) return null;
    if (selectedFaultPortId) {
      return findPortById(topology, selectedFaultPortId);
    }
    if (selection.kind === "port") {
      const port = findPort(topology, selection.hubId, selection.portIndex);
      if (port && isProblemPortStatus(port.status) && !selectedDevice) {
        return port;
      }
    }
    return null;
  }, [topology, selectedFaultPortId, selection, selectedDevice]);

  useEffect(() => {
    if (!topology || !selectedDeviceId) return;
    if (!topology.devices.some((d) => d.id === selectedDeviceId)) {
      setSelectedDeviceId(null);
    }
  }, [topology, selectedDeviceId]);

  useEffect(() => {
    if (!topology || !selectedFaultPortId) return;
    if (!findPortById(topology, selectedFaultPortId)) {
      setSelectedFaultPortId(null);
    }
  }, [topology, selectedFaultPortId]);

  const onSelectDevice = (id: string) => {
    setSelectedDeviceId(id);
    setSelectedFaultPortId(null);
    setMobileTab("details");
  };

  const onSelectFault = (port: UsbPort) => {
    setSelectedDeviceId(null);
    setSelectedFaultPortId(port.id);
    setSelection({
      kind: "port",
      id: port.id,
      hubId: port.hubId,
      portIndex: port.portIndex,
    });
    setMobileTab("details");
  };

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />

      <header className="app-header">
        <div className="brand-block">
          <p className="brand-mark" aria-hidden="true">
            ⎈
          </p>
          <div>
            <h1 className="brand">Deez USB Hub</h1>
            <p className="tagline">Windows topology · ports · descriptors</p>
            <p className="credit">
              Created by deac.online @ worldbuild.io
            </p>
          </div>
        </div>

        <div className="header-actions">
          {topology && (
            <p className="live-meta" aria-live="polite">
              {topology.devices.length} devices · {topology.controllers.length}{" "}
              controllers
            </p>
          )}
          <button
            type="button"
            className="btn-refresh"
            onClick={() => void refresh()}
            disabled={refreshing || state === "loading"}
            aria-busy={refreshing || state === "loading"}
          >
            {refreshing || state === "loading" ? "Scanning…" : "Refresh"}
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Panels">
        {(
          [
            ["ports", "Ports"],
            ["devices", "Devices"],
            ["details", "Details"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={mobileTab === id ? "is-active" : undefined}
            aria-pressed={mobileTab === id}
            onClick={() => setMobileTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className={`workspace tab-${mobileTab}`}>
        <div className="pane pane-ports">
          <PortsPanel
            topology={topology}
            selection={selection}
            onSelect={(s) => {
              setSelection(s);
              if (s.kind === "port" && topology) {
                const port = findPort(topology, s.hubId, s.portIndex);
                if (port && isProblemPortStatus(port.status)) {
                  setSelectedFaultPortId(port.id);
                  setSelectedDeviceId(null);
                } else {
                  setSelectedFaultPortId(null);
                  const device = topology.devices.find(
                    (d) =>
                      d.hubId === s.hubId && d.portIndex === s.portIndex,
                  );
                  setSelectedDeviceId(device?.id ?? null);
                }
              } else {
                setSelectedFaultPortId(null);
              }
              setMobileTab("devices");
            }}
            state={state}
            error={error}
          />
        </div>
        <div className="pane pane-devices">
          <DevicesPanel
            topology={topology}
            selection={selection}
            selectedDeviceId={selectedDeviceId}
            selectedFaultPortId={selectedFaultPortId}
            onSelectDevice={onSelectDevice}
            onSelectFault={onSelectFault}
            state={state}
            error={error}
          />
        </div>
        <div className="pane pane-details">
          <DetailsPanel
            device={selectedDevice}
            faultPort={faultPort}
            state={state}
            error={error}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
