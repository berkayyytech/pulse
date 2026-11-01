use keyring::{Entry, Error as KeyringError};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};
use tauri::Manager;
use tiny_http::{Header, Response, Server};
use url::Url;

const KEYRING_SERVICE: &str = "org.pulseplayer.client.vault";
const SETTINGS_FILE_NAME: &str = "pulse-settings.json";
const MAX_SETTINGS_BYTES: usize = 8 * 1024 * 1024;
const MAX_INSTALLER_BYTES: u64 = 150 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoopbackCallbackPayload {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

fn validate_vault_key(key: &str) -> Result<(), String> {
    if key.is_empty() || key.len() > 128 {
        return Err("Invalid vault key length".to_string());
    }
    if !key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == ':')
    {
        return Err("Invalid characters in vault key".to_string());
    }
    Ok(())
}

#[tauri::command]
fn vault_set(key: String, value: String) -> Result<(), String> {
    validate_vault_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_get(key: String) -> Result<Option<String>, String> {
    validate_vault_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn vault_delete(key: String) -> Result<(), String> {
    validate_vault_key(&key)?;
    let entry = Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;
    if parsed.scheme() == "spotify" {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            std::process::Command::new("cmd")
                .args(["/c", "start", "", &url])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| format!("Failed to open Spotify link: {e}"))?;
            return Ok(());
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::process::Command::new("xdg-open")
                .arg(&url)
                .spawn()
                .map_err(|e| format!("Failed to open Spotify link: {e}"))?;
            return Ok(());
        }
    }
    if parsed.scheme() != "https" {
        return Err("Only HTTPS or Spotify external URLs are permitted".to_string());
    }
    let host = parsed.host_str().unwrap_or_default();
    let allowed = matches!(
        host,
        "accounts.spotify.com"
            | "developer.spotify.com"
            | "open.spotify.com"
            | "www.spotify.com"
            | "spotify.com"
            | "lrclib.net"
            | "musicbrainz.org"
            | "coverartarchive.org"
            | "www.last.fm"
            | "github.com"
    );
    if !allowed {
        return Err(format!("Blocked external host: {host}"));
    }

    open::that_detached(parsed.as_str())
        .map_err(|e| format!("Failed to launch default system browser: {e}"))?;
    Ok(())
}

fn resolve_settings_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Unable to resolve OS app config directory: {e}"))?;
    Ok(dir.join(SETTINGS_FILE_NAME))
}

#[tauri::command]
fn desktop_get_settings_path(app: tauri::AppHandle) -> Result<String, String> {
    let path = resolve_settings_file_path(&app)?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn desktop_read_settings(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = resolve_settings_file_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read local settings file {}: {e}", path.display()))?;
    Ok(Some(contents))
}

#[tauri::command]
fn desktop_write_settings(app: tauri::AppHandle, contents: String) -> Result<String, String> {
    if contents.len() > MAX_SETTINGS_BYTES {
        return Err("Settings payload exceeds 8 MiB safety limit".to_string());
    }
    let path = resolve_settings_file_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory {}: {e}", parent.display()))?;
    }
    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, contents.as_bytes())
        .map_err(|e| format!("Failed to write temporary settings file: {e}"))?;
    if fs::rename(&tmp_path, &path).is_err() {
        fs::write(&path, contents.as_bytes())
            .map_err(|e| format!("Failed to save local settings file {}: {e}", path.display()))?;
        let _ = fs::remove_file(&tmp_path);
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn desktop_open_settings_dir(app: tauri::AppHandle) -> Result<(), String> {
    let path = resolve_settings_file_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create settings directory {}: {e}", parent.display()))?;
        open::that_detached(parent)
            .map_err(|e| format!("Failed to open settings folder in Explorer: {e}"))?;
    }
    Ok(())
}

fn is_allowed_update_host(host: &str) -> bool {
    matches!(
        host,
        "github.com"
            | "objects.githubusercontent.com"
            | "release-assets.githubusercontent.com"
            | "raw.githubusercontent.com"
    )
}

fn sanitize_installer_filename(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 120 {
        return Err("Invalid update asset filename".to_string());
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err("Unsafe characters in update asset filename".to_string());
    }
    if trimmed.contains("..") {
        return Err("Path traversal disallowed in update asset filename".to_string());
    }
    #[cfg(target_os = "windows")]
    if !trimmed.to_ascii_lowercase().ends_with(".exe")
        && !trimmed.to_ascii_lowercase().ends_with(".msi")
    {
        return Err("Windows update asset must be a .exe or .msi installer".to_string());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
async fn desktop_download_and_install_update(
    app: tauri::AppHandle,
    download_url: String,
    file_name: String,
    expected_sha256: Option<String>,
    silent_install: bool,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let parsed = Url::parse(&download_url).map_err(|e| format!("Invalid update URL: {e}"))?;
        if parsed.scheme() != "https" {
            return Err("Update downloads must use HTTPS".to_string());
        }
        let host = parsed.host_str().unwrap_or_default();
        if !is_allowed_update_host(host) {
            return Err(format!("Untrusted update host blocked: {host}"));
        }

        let safe_name = sanitize_installer_filename(&file_name)?;
        let mut resp_res = ureq::get(parsed.as_str())
            .set("User-Agent", "Pulse-Desktop-Updater/1.0")
            .call();

        // If downloading the specified asset returned an error and it's a GitHub release download URL,
        // try fallback standard installer names on the same release tag (e.g. Pulse_0.1.0_x64-setup.exe, Pulse.exe)
        if resp_res.is_err() && parsed.as_str().contains("/releases/download/") {
            let base_str = parsed.as_str();
            if let Some(last_slash) = base_str.rfind('/') {
                let release_prefix = &base_str[..last_slash];
                let fallback_names = ["Pulse_0.1.0_x64-setup.exe", "Pulse.exe"];
                for fb_name in fallback_names {
                    let fb_url = format!("{release_prefix}/{fb_name}");
                    if let Ok(p) = Url::parse(&fb_url) {
                        if let Ok(r) = ureq::get(p.as_str())
                            .set("User-Agent", "Pulse-Desktop-Updater/1.0")
                            .call()
                        {
                            resp_res = Ok(r);
                            break;
                        }
                    }
                }
            }
        }

        let response = resp_res.map_err(|e| format!("Failed to download update installer: {e}"))?;

        let final_url = Url::parse(response.get_url())
            .map_err(|e| format!("Invalid redirected update URL: {e}"))?;
        if final_url.scheme() != "https"
            || !is_allowed_update_host(final_url.host_str().unwrap_or_default())
        {
            return Err("Blocked redirect to untrusted update host".to_string());
        }

        let mut bytes = Vec::new();
        response
            .into_reader()
            .take(MAX_INSTALLER_BYTES)
            .read_to_end(&mut bytes)
            .map_err(|e| format!("Interrupted while downloading update installer: {e}"))?;

        if bytes.len() < 1024 {
            return Err("Downloaded installer payload was unexpectedly small".to_string());
        }

        if let Some(expected_raw) = expected_sha256 {
            let expected_hex = expected_raw
                .trim()
                .trim_start_matches("sha256:")
                .to_ascii_lowercase();
            if !expected_hex.is_empty() {
                let mut hasher = Sha256::new();
                hasher.update(&bytes);
                let actual_hex = format!("{:x}", hasher.finalize());
                if actual_hex != expected_hex {
                    return Err(
                        "SHA-256 checksum mismatch on downloaded installer — update aborted for safety"
                            .to_string(),
                    );
                }
            }
        }

        let update_dir = std::env::temp_dir().join("pulse-updates");
        fs::create_dir_all(&update_dir)
            .map_err(|e| format!("Failed to create temporary update folder: {e}"))?;
        let dest_path = update_dir.join(&safe_name);
        fs::write(&dest_path, &bytes)
            .map_err(|e| format!("Failed to save update installer to {}: {e}", dest_path.display()))?;

        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new(&dest_path);
            if silent_install {
                cmd.arg("/S");
            }
            cmd.spawn()
                .map_err(|e| format!("Failed to launch Windows update installer: {e}"))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = silent_install;
            open::that_detached(&dest_path)
                .map_err(|e| format!("Failed to open downloaded update package: {e}"))?;
        }

        let app_for_exit = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(450));
            app_for_exit.exit(0);
        });

        Ok(dest_path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn listen_loopback_oauth(
    port: u16,
    timeout_secs: u64,
) -> Result<LoopbackCallbackPayload, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bind_addr = format!("127.0.0.1:{port}");
        let server = Server::http(&bind_addr)
            .map_err(|e| format!("Failed to bind OAuth loopback listener on {bind_addr}: {e}"))?;

        let deadline = Instant::now() + Duration::from_secs(timeout_secs.clamp(10, 300));
        while Instant::now() < deadline {
            if let Ok(Some(request)) = server.recv_timeout(Duration::from_millis(250)) {
                let full_url = format!("http://127.0.0.1:{port}{}", request.url());
                let parsed = Url::parse(&full_url).map_err(|e| e.to_string())?;

                if parsed.path() != "/auth/callback" {
                    let _ = request.respond(Response::from_string("Not Found").with_status_code(404));
                    continue;
                }

                let mut code = None;
                let mut state = None;
                let mut error = None;
                for (k, v) in parsed.query_pairs() {
                    match k.as_ref() {
                        "code" => code = Some(v.into_owned()),
                        "state" => state = Some(v.into_owned()),
                        "error" => error = Some(v.into_owned()),
                        _ => {}
                    }
                }

                let html = r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pulse Authorization</title><style>body{background:#0B0D10;color:#F3F5F8;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}main{border:1px solid #242B35;border-radius:16px;padding:2rem;max-width:26rem;text-align:center}h1{color:#34C759;font-size:1.25rem;margin-top:0}</style></head><body><main><h1>Spotify Connected to Pulse</h1><p>You can close this browser tab and return to the Pulse desktop app.</p></main></body></html>"#;
                let content_type = Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
                    .map_err(|_| "Header error".to_string())?;
                let _ = request.respond(Response::from_string(html).with_header(content_type));

                return Ok(LoopbackCallbackPayload { code, state, error });
            }
        }

        Err("Timed out waiting for Spotify authorization callback on 127.0.0.1".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            vault_set,
            vault_get,
            vault_delete,
            open_external_url,
            desktop_get_settings_path,
            desktop_read_settings,
            desktop_write_settings,
            desktop_open_settings_dir,
            desktop_download_and_install_update,
            listen_loopback_oauth
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pulse desktop shell");
}
