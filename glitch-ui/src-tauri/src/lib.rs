use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct SshResult {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

/// Run a command on the VPS over SSH and return stdout/stderr
#[tauri::command]
async fn ssh_run(host: String, user: String, cmd: String) -> Result<SshResult, String> {
    let output = Command::new("ssh")
        .args([
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-o", "BatchMode=yes",
            &format!("{}@{}", user, host),
            &cmd,
        ])
        .output()
        .map_err(|e| format!("SSH error: {}", e))?;

    Ok(SshResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}

/// Start the SSH tunnel in the background (non-blocking)
#[tauri::command]
async fn start_tunnel(host: String, user: String, local_port: u16, remote_port: u16) -> Result<String, String> {
    Command::new("ssh")
        .args([
            "-o", "StrictHostKeyChecking=no",
            "-o", "ExitOnForwardFailure=yes",
            "-N", "-f",
            "-L", &format!("{}:127.0.0.1:{}", local_port, remote_port),
            &format!("{}@{}", user, host),
        ])
        .spawn()
        .map_err(|e| format!("Tunnel error: {}", e))?;

    Ok(format!("Tunnel started: localhost:{} -> {}:{}", local_port, host, remote_port))
}

/// Kill any existing SSH tunnel on the given local port
#[tauri::command]
async fn stop_tunnel(local_port: u16) -> Result<String, String> {
    // Windows: use netstat + taskkill
    let find = Command::new("cmd")
        .args(["/C", &format!("for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :{} ') do taskkill /F /PID %a", local_port)])
        .output()
        .map_err(|e| format!("Stop tunnel error: {}", e))?;

    Ok(String::from_utf8_lossy(&find.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![ssh_run, start_tunnel, stop_tunnel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
