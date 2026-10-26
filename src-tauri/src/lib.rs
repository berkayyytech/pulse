use keyring::{Entry, Error as KeyringError};
use serde::Serialize;
use std::time::{Duration, Instant};
use tiny_http::{Header, Response, Server};
use url::Url;

const KEYRING_SERVICE: &str = "org.pulseplayer.client.vault";

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
    if parsed.scheme() != "https" {
        return Err("Only HTTPS external URLs are permitted".to_string());
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
            listen_loopback_oauth
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pulse desktop shell");
}
