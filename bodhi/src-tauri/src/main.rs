#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod state;

use std::sync::Mutex;
use std::time::Duration;

use tauri::{Emitter, Manager, PhysicalPosition, Position, WindowEvent};
use tauri_plugin_store::StoreExt;

use state::{AppState, DbHealth, PetSnapshot};

const PET_WINDOW_LABEL: &str = "pet";
const STATE_EVENT: &str = "bodhi://state";
const STORE_PATH: &str = "bodhi.dat";
const POS_KEY: &str = "pet-pos";

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(pet) = app.get_webview_window(PET_WINDOW_LABEL) {
                let _ = pet.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(Mutex::new(AppState::default()))
        .setup(|app| {
            // SQLite first: migrate, then share the pool with commands.
            let pool = tauri::async_runtime::block_on(db::connect(app))?;
            app.manage(pool);

            // Restore the pet's position, then persist it on every move.
            let store = app.store(STORE_PATH)?;
            if let Some(pet) = app.get_webview_window(PET_WINDOW_LABEL) {
                if let Some(pos) = store.get(POS_KEY.to_string()) {
                    if let (Some(x), Some(y)) = (
                        pos.get(0).and_then(serde_json::Value::as_i64),
                        pos.get(1).and_then(serde_json::Value::as_i64),
                    ) {
                        let _ = pet.set_position(Position::Physical(PhysicalPosition {
                            x: x as i32,
                            y: y as i32,
                        }));
                    }
                }
                let store = store.clone();
                pet.on_window_event(move |event| {
                    if let WindowEvent::Moved(position) = event {
                        store.set(
                            POS_KEY.to_string(),
                            serde_json::json!([position.x, position.y]),
                        );
                    }
                });
            }

            // 2 Hz state broadcast (M1 grows this into the timer loop).
            let app_handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_millis(500));
                let snapshot = app_handle
                    .state::<Mutex<AppState>>()
                    .lock()
                    .map(|guard| guard.snapshot())
                    .unwrap_or_default();
                let _ = app_handle.emit(STATE_EVENT, snapshot);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_state, db_health])
        .run(tauri::generate_context!())
        .expect("error while running Bodhi");
}

#[tauri::command]
fn get_state(state: tauri::State<'_, Mutex<AppState>>) -> PetSnapshot {
    state.lock().map(|guard| guard.snapshot()).unwrap_or_default()
}

#[tauri::command]
async fn db_health(pool: tauri::State<'_, sqlx::SqlitePool>) -> Result<DbHealth, String> {
    let (sessions,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sessions")
        .fetch_one(pool.inner())
        .await
        .map_err(|err| err.to_string())?;
    Ok(DbHealth { ok: true, sessions })
}
