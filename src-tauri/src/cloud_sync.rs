use serde::Deserialize;
use reqwest;

#[derive(Deserialize, Debug)]
pub struct SteamOwnedGamesResponse {
    pub response: SteamOwnedGames,
}

#[derive(Deserialize, Debug)]
pub struct SteamOwnedGames {
    pub game_count: Option<u32>,
    pub games: Option<Vec<SteamGame>>,
}

#[derive(Deserialize, Debug)]
pub struct SteamGame {
    pub appid: u32,
    pub name: Option<String>,
    pub playtime_forever: Option<u32>, // Em minutos
}

const STEAM_API_KEY: &str = env!("STEAM_API_KEY");

#[tauri::command]
pub async fn sync_steam_cloud(
    app: tauri::AppHandle,
    steam_id: String,
) -> Result<u32, String> {
    if steam_id.is_empty() {
        return Err("Steam ID ausente".to_string());
    }

    let url = format!(
        "http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={}&steamid={}&format=json&include_appinfo=1",
        STEAM_API_KEY.trim(), steam_id
    );

    let client = reqwest::Client::new();
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Erro na API da Steam: {}", res.status()));
    }

    let data: SteamOwnedGamesResponse = res.json().await.map_err(|e| e.to_string())?;

    let games = match data.response.games {
        Some(g) => g,
        None => return Ok(0), // Sem jogos ou perfil privado
    };

    let conn = crate::commands::get_conn(&app)?;
    let mut imported = 0;

    for g in games {
        // Ignora ferramentas de vídeo e softwares inúteis (geralmente não tem playtime e nome genérico, mas vamos pegar tudo por enquanto)
        let name = g.name.unwrap_or_else(|| format!("Steam App {}", g.appid));
        let exe_path = format!("steam://rungameid/{}", g.appid);
        let playtime_seconds = (g.playtime_forever.unwrap_or(0) * 60) as i64;

        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM games WHERE exe_path = ?1)",
            [&exe_path],
            |row| row.get(0),
        ).unwrap_or(false);

        let game_id: i64 = if !exists {
            let cover_url = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg", g.appid);
            conn.execute(
                "INSERT INTO games (name, exe_path, genre, is_installed, cover_path) VALUES (?1, ?2, 'Steam', 0, ?3)",
                (&name, &exe_path, &cover_url),
            ).map_err(|e| e.to_string())?;
            imported += 1;
            conn.last_insert_rowid()
        } else {
            let cover_url = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{}/library_600x900_2x.jpg", g.appid);
            // Garante capa mesmo em jogos já existentes sem capa
            let _ = conn.execute(
                "UPDATE games SET cover_path = COALESCE(cover_path, ?2) WHERE exe_path = ?1",
                (&exe_path, &cover_url),
            );
            conn.query_row(
                "SELECT id FROM games WHERE exe_path = ?1",
                [&exe_path],
                |row| row.get(0),
            ).unwrap_or(0)
        };

        if game_id > 0 && playtime_seconds > 0 {
            // Sincronizar o playtime: adicionamos uma sessão invisível com a diferença do tempo
            let local_playtime: i64 = conn.query_row(
                "SELECT COALESCE(SUM(duration_seconds), 0) FROM sessions WHERE game_id = ?1",
                [game_id],
                |row| row.get(0),
            ).unwrap_or(0);

            if playtime_seconds > local_playtime {
                let diff = playtime_seconds - local_playtime;
                conn.execute(
                    "INSERT INTO sessions (game_id, started_at, ended_at, duration_seconds) 
                     VALUES (?1, datetime('now', '-1 day'), datetime('now', '-1 day'), ?2)",
                    (game_id, diff),
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(imported)
}
