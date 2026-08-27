use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct WatcherState {
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
        }
    }
}

// 启动目录文件变动监听（带防抖通知）
#[tauri::command]
fn start_watching_directory(
    path: String,
    app: AppHandle,
    state: State<'_, WatcherState>,
) -> Result<(), String> {
    let watch_path = Path::new(&path);
    if !watch_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut watcher_lock = state
        .watcher
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    // 释放之前的监听器
    *watcher_lock = None;

    let app_clone = app.clone();
    let last_trigger = Arc::new(Mutex::new(Instant::now()));
    let last_event_id = Arc::new(AtomicU64::new(0));

    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| match res {
            Ok(event) => match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                    let mut last = last_trigger.lock().unwrap();
                    let now = Instant::now();
                    // 600ms 防抖
                    if now.duration_since(*last) > Duration::from_millis(600) {
                        *last = now;
                        let _ = app_clone.emit("app://fs-changed", ());
                    } else {
                        *last = now;
                        let app_inner = app_clone.clone();
                        let event_id = last_event_id.fetch_add(1, Ordering::SeqCst) + 1;
                        let id_holder = last_event_id.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(650));
                            if id_holder.load(Ordering::SeqCst) == event_id {
                                let _ = app_inner.emit("app://fs-changed", ());
                            }
                        });
                    }
                }
                _ => {}
            },
            Err(e) => {
                eprintln!("Directory watch error: {:?}", e);
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to initialize watcher: {}", e))?;

    watcher
        .watch(watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watch path: {}", e))?;

    *watcher_lock = Some(watcher);
    Ok(())
}

// 停止目录文件监听
#[tauri::command]
fn stop_watching_directory(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_lock = state
        .watcher
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    *watcher_lock = None;
    Ok(())
}

mod stream;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                }
            }
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("stream", |_ctx, request, responder| {
            tauri::async_runtime::spawn_blocking(move || {
                let response = match stream::handle_stream_request(request) {
                    Ok(resp) => resp,
                    Err(err) => {
                        eprintln!("Stream protocol error: {:?}", err);
                        tauri::http::Response::builder()
                            .status(tauri::http::StatusCode::INTERNAL_SERVER_ERROR)
                            .header(tauri::http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                            .header(tauri::http::header::CONTENT_TYPE, "text/plain")
                            .body(err.to_string().into_bytes())
                            .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
                    }
                };
                responder.respond(response);
            });
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            start_watching_directory,
            stop_watching_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tik-clip application");
}
