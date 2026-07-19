import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  PortDiagnosticResult,
  PortRecoveryResult,
  UsbDevice,
  UsbTopology,
} from "../types/usb";

export async function fetchTopology(): Promise<UsbTopology> {
  return invoke<UsbTopology>("get_topology");
}

export async function fetchDeviceDetail(id: string): Promise<UsbDevice> {
  return invoke<UsbDevice>("get_device_detail", { id });
}

export async function diagnosePort(portId: string): Promise<PortDiagnosticResult> {
  return invoke<PortDiagnosticResult>("diagnose_port", { portId });
}

export async function cyclePort(portId: string): Promise<PortRecoveryResult> {
  return invoke<PortRecoveryResult>("cycle_port", { portId });
}

export async function onTopologyChanged(
  handler: (topology: UsbTopology) => void,
): Promise<UnlistenFn> {
  return listen<UsbTopology>("usb://topology-changed", (event) => {
    handler(event.payload);
  });
}
