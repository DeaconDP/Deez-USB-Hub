mod usb;

use std::sync::{Arc, Mutex};
use usb::model::{PortDiagnosticResult, PortRecoveryResult, UsbDevice};
use usb::watch::{start_watcher, update_fingerprint};
use usb::{
    cycle_port as cycle_port_backend, diagnose_port as diagnose_port_backend, enumerate, get_device,
};

struct AppState {
    last_fingerprint: Arc<Mutex<String>>,
    operation_lock: Arc<Mutex<()>>,
}

#[tauri::command]
fn get_topology(state: tauri::State<'_, AppState>) -> Result<usb::model::UsbTopology, String> {
    let topo = enumerate()?;
    update_fingerprint(&state.last_fingerprint, &topo);
    Ok(topo)
}

#[tauri::command]
fn get_device_detail(state: tauri::State<'_, AppState>, id: String) -> Result<UsbDevice, String> {
    let topo = enumerate()?;
    update_fingerprint(&state.last_fingerprint, &topo);
    get_device(&topo, &id).ok_or_else(|| format!("USB-001: Device not found: {id}"))
}

#[tauri::command]
async fn diagnose_port(
    state: tauri::State<'_, AppState>,
    port_id: String,
) -> Result<PortDiagnosticResult, String> {
    let operation_lock = state.operation_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = operation_lock
            .try_lock()
            .map_err(|_| "USB-006: Another USB operation is already running".to_string())?;
        diagnose_port_backend(&port_id)
    })
    .await
    .map_err(|error| format!("USB-006: Diagnostic worker failed: {error}"))?
}

#[tauri::command]
async fn cycle_port(
    state: tauri::State<'_, AppState>,
    port_id: String,
) -> Result<PortRecoveryResult, String> {
    let operation_lock = state.operation_lock.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = operation_lock
            .try_lock()
            .map_err(|_| "USB-006: Another USB operation is already running".to_string())?;
        cycle_port_backend(&port_id)
    })
    .await
    .map_err(|error| format!("USB-006: Recovery worker failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let fingerprint = Arc::new(Mutex::new(String::new()));
    let fp_for_watch = fingerprint.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            last_fingerprint: fingerprint,
            operation_lock: Arc::new(Mutex::new(())),
        })
        .invoke_handler(tauri::generate_handler![
            get_topology,
            get_device_detail,
            diagnose_port,
            cycle_port
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            start_watcher(handle, fp_for_watch);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
