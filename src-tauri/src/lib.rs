mod db;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            db::init(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_game,
            commands::list_games,
            commands::launch_game,
            commands::is_process_running,
            commands::close_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}