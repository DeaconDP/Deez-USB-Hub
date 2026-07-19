import { useCallback, useEffect, useRef, useState } from "react";
import { cyclePort, diagnosePort } from "../api/usb";
import type {
  PortDiagnosticResult,
  PortRecoveryResult,
} from "../types/usb";

type DiagnosticState = "idle" | "running" | "success" | "error" | "cancelled";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePortDiagnostic(
  portId: string | null,
  refresh: () => Promise<void>,
) {
  const [state, setState] = useState<DiagnosticState>("idle");
  const [result, setResult] = useState<PortDiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sampleProgress, setSampleProgress] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryResult, setRecoveryResult] =
    useState<PortRecoveryResult | null>(null);
  const operation = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    operation.current += 1;
    setState("idle");
    setResult(null);
    setError(null);
    setBusy(false);
    setSampleProgress(0);
    setCancelled(false);
    setRecoveryBusy(false);
    setRecoveryResult(null);
    cancelledRef.current = false;
  }, [portId]);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      setSampleProgress((value) => Math.min(11, value + 1));
    }, 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  const start = useCallback(async () => {
    if (!portId || busy || recoveryBusy) return;
    const current = ++operation.current;
    setState("running");
    setResult(null);
    setError(null);
    setRecoveryResult(null);
    setCancelled(false);
    cancelledRef.current = false;
    setSampleProgress(0);
    setBusy(true);
    try {
      const next = await diagnosePort(portId);
      if (operation.current !== current) return;
      if (cancelledRef.current) return;
      setResult(next);
      setSampleProgress(next.samples.length);
      setState("success");
    } catch (cause) {
      if (operation.current !== current) return;
      setError(messageFrom(cause));
      setState("error");
    } finally {
      if (operation.current === current) setBusy(false);
    }
  }, [busy, portId, recoveryBusy]);

  const cancel = useCallback(() => {
    if (!busy) return;
    cancelledRef.current = true;
    setCancelled(true);
    setState("cancelled");
  }, [busy]);

  const recover = useCallback(async () => {
    if (!portId || busy || recoveryBusy) return;
    setRecoveryBusy(true);
    setRecoveryResult(null);
    setError(null);
    try {
      const next = await cyclePort(portId);
      setRecoveryResult(next);
      await refresh();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setRecoveryBusy(false);
    }
  }, [busy, portId, recoveryBusy, refresh]);

  return {
    state,
    result,
    error,
    busy,
    sampleProgress,
    cancelled,
    recoveryBusy,
    recoveryResult,
    start,
    cancel,
    recover,
  };
}
