mod usb;

use std::sync::{Arc, Mutex};
use usb::model::UsbDevice;
use usb::watch::{start_watcher, update_fingerprint};
use usb::{enumerate, get_device};

struct AppState {
    last_fingerprint: Arc<Mutex<String>>,
}

#[tauri::command]
fn get_topology(state: tauri::State<'_, AppState>) -> Result<usb::model::UsbTopology, String> {
    let topo = enumerate()?;
    update_fingerprint(&state.last_fingerprint, &topo);
    Ok(topo)
}

#[tauri::command]
fn get_device_detail(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<UsbDevice, String> {
    let topo = enumerate().map_err(|e| e)?;
    update_fingerprint(&state.last_fingerprint, &topo);
    get_device(&topo, &id).ok_or_else(|| format!("USB-001: Device not found: {id}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let fingerprint = Arc::new(Mutex::new(String::new()));
    let fp_for_watch = fingerprint.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            last_fingerprint: fingerprint,
        })
        .invoke_handler(tauri::generate_handler![get_topology, get_device_detail])
        .setup(move |app| {
            let handle = app.handle().clone();
            start_watcher(handle, fp_for_watch);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
