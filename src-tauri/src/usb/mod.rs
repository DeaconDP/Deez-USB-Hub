pub mod model;
pub mod watch;

#[cfg(windows)]
mod pnp;
#[cfg(windows)]
mod windows_hubs;

#[cfg(test)]
mod smoke_test;

use model::{
    chrono_like_now, classify_diagnostic, PortDiagnosticResult, PortDiagnosticSample,
    PortRecoveryResult, PortStatus, RecoveryStatus, UsbDevice, UsbHub, UsbPort, UsbTopology,
};
use std::time::Duration;

#[allow(dead_code)]
pub trait UsbBackend {
    fn enumerate(&self) -> Result<UsbTopology, String>;
}

#[allow(dead_code)]
pub struct PlatformBackend;

impl UsbBackend for PlatformBackend {
    fn enumerate(&self) -> Result<UsbTopology, String> {
        enumerate()
    }
}

pub fn enumerate() -> Result<UsbTopology, String> {
    #[cfg(windows)]
    {
        windows_hubs::enumerate_topology()
    }
    #[cfg(not(windows))]
    {
        Ok(UsbTopology::empty_with_warning(
            "USB-003",
            "This build only supports Windows USB hub enumeration.",
        ))
    }
}

pub fn get_device(topology: &UsbTopology, id: &str) -> Option<model::UsbDevice> {
    topology.devices.iter().find(|d| d.id == id).cloned()
}

pub fn diagnose_port(port_id: &str) -> Result<PortDiagnosticResult, String> {
    validate_port_id(port_id)?;
    let mut samples = Vec::with_capacity(12);
    let mut blocked_reason = None;

    for index in 0..12 {
        let topology = enumerate()?;
        let port = find_port_by_id(&topology, port_id)
            .ok_or_else(|| format!("USB-001: Port not found: {port_id}"))?;
        let device = port
            .device_id
            .as_deref()
            .and_then(|id| topology.devices.iter().find(|device| device.id == id));
        if blocked_reason.is_none() {
            blocked_reason = recovery_block_reason(port, device);
        }
        samples.push(PortDiagnosticSample {
            status: port.status.clone(),
            status_label: port.status_label.clone(),
            device_id: port.device_id.clone(),
            speed: port.speed.clone(),
            pnp_problem_code: device.and_then(|device| device.pnp_problem_code),
            sampled_at: chrono_like_now(),
        });
        if index < 11 {
            std::thread::sleep(Duration::from_millis(500));
        }
    }

    Ok(classify_diagnostic(
        port_id.to_string(),
        samples,
        blocked_reason,
    ))
}

pub fn cycle_port(port_id: &str) -> Result<PortRecoveryResult, String> {
    validate_port_id(port_id)?;
    let before = enumerate()?;
    let port = find_port_by_id(&before, port_id)
        .ok_or_else(|| format!("USB-001: Port not found: {port_id}"))?;
    let device = port
        .device_id
        .as_deref()
        .and_then(|id| before.devices.iter().find(|device| device.id == id));

    if let Some(reason) = recovery_block_reason(port, device) {
        return Ok(PortRecoveryResult {
            port_id: port_id.to_string(),
            status: RecoveryStatus::Denied,
            code: "USB-005".into(),
            message: reason,
            before_status: port.status.clone(),
            after_status: None,
        });
    }

    #[cfg(windows)]
    {
        let hub = find_hub(&before, &port.hub_id)
            .ok_or_else(|| format!("USB-001: Hub not found: {}", port.hub_id))?;
        let path = hub
            .device_path
            .as_deref()
            .ok_or_else(|| "USB-005: Hub has no usable device path".to_string())?;
        match windows_hubs::cycle_port_device(path, port.port_index) {
            Err(error) => {
                let elevation = error.to_ascii_lowercase().contains("access")
                    || error.contains("0x80070005")
                    || error.contains("(5)");
                return Ok(PortRecoveryResult {
                    port_id: port_id.to_string(),
                    status: if elevation {
                        RecoveryStatus::ElevationRequired
                    } else {
                        RecoveryStatus::Failed
                    },
                    code: "USB-004".into(),
                    message: if elevation {
                        "Windows denied the port cycle. Close the app and run it as administrator, then try again.".into()
                    } else {
                        format!("Windows could not cycle this port: {error}")
                    },
                    before_status: port.status.clone(),
                    after_status: None,
                });
            }
            Ok(status) if status != 0 => {
                return Ok(PortRecoveryResult {
                    port_id: port_id.to_string(),
                    status: RecoveryStatus::Failed,
                    code: "USB-004".into(),
                    message: format!(
                        "Windows accepted the request but returned port-cycle status 0x{status:08X}."
                    ),
                    before_status: port.status.clone(),
                    after_status: None,
                });
            }
            Ok(_) => {}
        }

        std::thread::sleep(Duration::from_millis(1500));
        let after = enumerate()?;
        let after_status = find_port_by_id(&after, port_id).map(|port| port.status.clone());
        Ok(PortRecoveryResult {
            port_id: port_id.to_string(),
            status: RecoveryStatus::Succeeded,
            code: "USB-000".into(),
            message: "Windows cycled the port. The reported state shown here is the first observation after recovery.".into(),
            before_status: port.status.clone(),
            after_status,
        })
    }
    #[cfg(not(windows))]
    {
        Ok(PortRecoveryResult {
            port_id: port_id.to_string(),
            status: RecoveryStatus::Denied,
            code: "USB-003".into(),
            message: "Port recovery is only available on Windows.".into(),
            before_status: port.status.clone(),
            after_status: None,
        })
    }
}

fn validate_port_id(port_id: &str) -> Result<(), String> {
    if port_id.is_empty()
        || port_id.len() > 128
        || !port_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("USB-005: Invalid port identifier".into());
    }
    Ok(())
}

fn find_port_by_id<'a>(topology: &'a UsbTopology, port_id: &str) -> Option<&'a UsbPort> {
    fn walk<'a>(hubs: &'a [UsbHub], port_id: &str) -> Option<&'a UsbPort> {
        for hub in hubs {
            if let Some(port) = hub.ports.iter().find(|port| port.id == port_id) {
                return Some(port);
            }
            if let Some(port) = walk(&hub.child_hubs, port_id) {
                return Some(port);
            }
        }
        None
    }
    topology
        .controllers
        .iter()
        .find_map(|controller| walk(&controller.hubs, port_id))
}

fn find_hub<'a>(topology: &'a UsbTopology, hub_id: &str) -> Option<&'a UsbHub> {
    fn walk<'a>(hubs: &'a [UsbHub], hub_id: &str) -> Option<&'a UsbHub> {
        for hub in hubs {
            if hub.id == hub_id {
                return Some(hub);
            }
            if let Some(found) = walk(&hub.child_hubs, hub_id) {
                return Some(found);
            }
        }
        None
    }
    topology
        .controllers
        .iter()
        .find_map(|controller| walk(&controller.hubs, hub_id))
}

fn recovery_block_reason(port: &UsbPort, device: Option<&UsbDevice>) -> Option<String> {
    if port.status == PortStatus::Overcurrent {
        return Some(
            "Recovery is blocked for overcurrent. Unplug the device and inspect the connector, cable, and power source.".into(),
        );
    }
    let device = device?;
    if device.is_hub || device.device_class == 0x09 || has_interface_class(device, 0x09) {
        return Some(
            "Recovery is blocked because this port carries a USB hub or downstream devices.".into(),
        );
    }
    if device.device_class == 0x08 || has_interface_class(device, 0x08) {
        return Some("Recovery is blocked for storage devices to avoid data loss.".into());
    }
    if device.device_class == 0x03 || has_interface_class(device, 0x03) {
        return Some(
            "Recovery is blocked for input devices so the keyboard or mouse is not disconnected."
                .into(),
        );
    }
    if matches!(device.device_class, 0x02 | 0xe0)
        || has_interface_class(device, 0x02)
        || has_interface_class(device, 0xe0)
    {
        return Some(
            "Recovery is blocked for network or wireless devices to avoid dropping connectivity."
                .into(),
        );
    }
    None
}

fn has_interface_class(device: &UsbDevice, class: u8) -> bool {
    device
        .configurations
        .iter()
        .flat_map(|configuration| &configuration.interfaces)
        .any(|interface| interface.class == class)
}

#[cfg(test)]
mod tests {
    use super::{recovery_block_reason, validate_port_id};
    use crate::usb::model::{PortStatus, UsbDevice, UsbPort};

    #[test]
    fn rejects_untrusted_port_ids() {
        assert!(validate_port_id(r"\\.\ROOT_HUB").is_err());
        assert!(validate_port_id("../hc-0-root-p1").is_err());
        assert!(validate_port_id("hc-0-root-p1").is_ok());
    }

    fn test_device(class: u8) -> UsbDevice {
        UsbDevice {
            id: "device".into(),
            hub_id: "hub".into(),
            port_index: 1,
            port_chain: vec![1],
            vendor_id: 1,
            product_id: 1,
            revision: None,
            manufacturer: None,
            product: None,
            serial: None,
            friendly_name: None,
            device_class: class,
            device_subclass: 0,
            device_protocol: 0,
            max_packet_size0: 64,
            num_configurations: 0,
            address: 1,
            speed: None,
            superspeed: None,
            is_hub: false,
            connection_status: "Connected".into(),
            driver_key: None,
            instance_id: None,
            service: None,
            location_paths: vec![],
            container_id: None,
            pnp_status: None,
            pnp_problem_code: None,
            configurations: vec![],
        }
    }

    fn test_port(status: PortStatus) -> UsbPort {
        UsbPort {
            id: "hub-p1".into(),
            hub_id: "hub".into(),
            port_index: 1,
            status: status.clone(),
            status_label: format!("{status:?}"),
            speed: None,
            superspeed: None,
            device_id: None,
            is_hub: false,
        }
    }

    #[test]
    fn blocks_overcurrent_and_storage_recovery() {
        assert!(recovery_block_reason(&test_port(PortStatus::Overcurrent), None).is_some());
        assert!(
            recovery_block_reason(&test_port(PortStatus::Connected), Some(&test_device(0x08)))
                .is_some()
        );
    }
}
