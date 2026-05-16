use tauri::Manager;
use super::game_commands::get_conn;

#[tauri::command]
pub async fn search_igdb(name: String) -> Result<Option<crate::igdb::GameMetadata>, String> {
    crate::igdb::search_game(&name, 0).await
}

#[tauri::command]
pub async fn search_igdb_preview(name: String, offset: u32) -> Result<Option<crate::igdb::GameMetadata>, String> {
    crate::igdb::search_game(&name, offset).await
}

#[tauri::command]
pub async fn fetch_igdb_cover(
    app: tauri::AppHandle,
    game_id: i64,
    game_name: String,
) -> Result<Option<String>, String> {
    let metadata = crate::igdb::search_game(&game_name, 0).await?;

    let Some(meta) = metadata else {
        // Se não achou na API, coloca descrição vazia para não ficar buscando infinitamente
        let conn = get_conn(&app)?;
        let _ = conn.execute("UPDATE games SET description = '' WHERE id = ?1", [&game_id]);
        return Ok(None);
    };

    let conn = get_conn(&app)?;

    if let Some(summary) = &meta.summary {
        conn.execute(
            "UPDATE games SET description = ?1 WHERE id = ?2",
            (summary, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    if let Some(genre) = &meta.genre {
        conn.execute(
            "UPDATE games SET genre = ?1 WHERE id = ?2",
            (genre, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    let Some(cover_url) = meta.cover_url else {
        return Ok(None);
    };

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let covers_dir = app_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    let cover_path = covers_dir.join(format!("{}.jpg", game_id));
    let response = reqwest::get(&cover_url).await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&cover_path, &bytes).map_err(|e| e.to_string())?;

    let path_str = cover_path.to_str().unwrap_or("").to_string();
    conn.execute(
        "UPDATE games SET cover_path = ?1 WHERE id = ?2",
        (&path_str, &game_id),
    ).map_err(|e| e.to_string())?;

    Ok(Some(path_str))
}

#[tauri::command]
pub async fn save_igdb_data(
    app: tauri::AppHandle,
    game_id: i64,
    cover_url: Option<String>,
    summary: Option<String>,
    genre: Option<String>,
) -> Result<Option<String>, String> {
    let conn = get_conn(&app)?;

    if let Some(ref s) = summary {
        conn.execute(
            "UPDATE games SET description = ?1 WHERE id = ?2",
            (s, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    if let Some(ref g) = genre {
        conn.execute(
            "UPDATE games SET genre = ?1 WHERE id = ?2",
            (g, &game_id),
        ).map_err(|e| e.to_string())?;
    }

    let Some(url) = cover_url else {
        return Ok(None);
    };

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let covers_dir = app_dir.join("covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    let cover_path = covers_dir.join(format!("{}.jpg", game_id));
    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&cover_path, &bytes).map_err(|e| e.to_string())?;

    let path_str = cover_path.to_str().unwrap_or("").to_string();
    conn.execute(
        "UPDATE games SET cover_path = ?1 WHERE id = ?2",
        (&path_str, &game_id),
    ).map_err(|e| e.to_string())?;

    Ok(Some(path_str))
}

#[tauri::command]
pub async fn auto_fetch_missing_metadata(app: tauri::AppHandle) -> Result<i32, String> {
    let games: Vec<(i64, String)> = {
        let conn = get_conn(&app)?;
        let mut stmt = conn.prepare("SELECT id, name FROM games WHERE description IS NULL LIMIT 10").map_err(|e| e.to_string())?;
        
        let list: Vec<(i64, String)> = stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        list
    };

    if games.is_empty() {
        return Ok(0);
    }

    let mut fetched = 0;
    for (id, name) in games {
        // Tenta buscar no IGDB reutilizando a função já pronta
        if let Ok(Some(_)) = fetch_igdb_cover(app.clone(), id, name.clone()).await {
            fetched += 1;
        }
    }
    
    Ok(fetched)
}
