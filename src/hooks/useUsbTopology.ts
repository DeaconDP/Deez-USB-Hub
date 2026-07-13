import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTopology, onTopologyChanged } from "../api/usb";
import type { UsbTopology } from "../types/usb";

export type LoadState = "loading" | "ready" | "error" | "empty";

export function useUsbTopology() {
  const [topology, setTopology] = useState<UsbTopology | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busyRef = useRef(false);

  const applyTopology = useCallback((topo: UsbTopology) => {
    setTopology(topo);
    if (topo.controllers.length === 0 && topo.devices.length === 0) {
      setState("empty");
    } else {
      setState("ready");
    }
    setError(null);
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (manual) setRefreshing(true);
    else if (!topology) setState("loading");

    try {
      const topo = await fetchTopology();
      applyTopology(topo);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "USB-001: Could not enumerate USB topology.";
      setError(message);
      setState("error");
    } finally {
      busyRef.current = false;
      setRefreshing(false);
    }
  }, [applyTopology, topology]);

  useEffect(() => {
    void refresh(false);
    let unlisten: (() => void) | undefined;
    void onTopologyChanged((topo) => {
      applyTopology(topo);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    topology,
    state,
    error,
    refreshing,
    refresh: () => refresh(true),
  };
}
