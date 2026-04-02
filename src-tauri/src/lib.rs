mod db;
mod commands;
mod gamepad;
mod igdb;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            db::init(app.handle())?;
            gamepad::start_gamepad_listener(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::add_game,
            commands::list_games,
            commands::launch_game,
            commands::is_process_running,
            commands::close_session,
            commands::scan_folder,
            commands::import_games,
            commands::toggle_favorite,
            commands::delete_game,
            commands::get_game_playtime,
            commands::update_game,
            commands::get_game_sessions,
            commands::get_global_stats,
            commands::get_setting,
            commands::set_setting,
            commands::set_window_mode,
            commands::shutdown_system,
            commands::restart_system,
            commands::exit_to_windows,
            commands::search_igdb,
            commands::fetch_igdb_cover,
            commands::search_igdb_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}