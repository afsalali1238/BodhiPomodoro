//! SQLite via sqlx, used directly from Rust. The backend owns all data, so
//! the frontend needs no SQL permissions — every query hides behind a
//! typed Tauri command. Single-connection pool + WAL mode.

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use tauri::Manager;

pub type DbError = Box<dyn std::error::Error + Send + Sync>;

/// Connect to `<app_data>/bodhi.db`, run migrations, enable WAL.
pub async fn connect(app: &tauri::App) -> Result<SqlitePool, DbError> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    let options = SqliteConnectOptions::new()
        .filename(dir.join("bodhi.db"))
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await?;
    sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    Ok(pool)
}
