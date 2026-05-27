use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const CLIENT_ID: &str = "lgxanf3dnk8w4ha5nb6ch8n5wgyw5m";
const CLIENT_SECRET: &str = "mioyl7w4hhrt5kfv9tori6pkr5zg85";

static TOKEN_CACHE: Mutex<Option<String>> = Mutex::new(None);

#[derive(Deserialize)]
struct TwitchTokenResponse {
    access_token: String,
}

#[derive(Deserialize, Debug)]
struct IGDBGame {
    name: Option<String>,
    summary: Option<String>,
    genres: Option<Vec<IGDBGenre>>,
    cover: Option<IGDBCover>,
}

#[derive(Deserialize, Debug)]
struct IGDBGenre {
    name: String,
}

#[derive(Deserialize, Debug)]
struct IGDBCover {
    image_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameMetadata {
    pub name: String,
    pub summary: Option<String>,
    pub genre: Option<String>,
    pub cover_url: Option<String>,
}

async fn get_token() -> Result<String, String> {
    {
        let cache = TOKEN_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some(token) = cache.as_ref() {
            return Ok(token.clone());
        }
    }

    let client = reqwest::Client::new();
    let resp = client
        .post("https://id.twitch.tv/oauth2/token")
        .query(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("grant_type", "client_credentials"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<TwitchTokenResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let token = resp.access_token.clone();
    let mut cache = TOKEN_CACHE.lock().map_err(|e| e.to_string())?;
    *cache = Some(resp.access_token);

    Ok(token)
}

pub async fn search_game(name: &str, offset: u32) -> Result<Option<GameMetadata>, String> {
    let token = get_token().await?;
    let client = reqwest::Client::new();

    let body = format!(
        "search \"{}\"; fields name,summary,genres.name,cover.image_id; limit 1; offset {};",
        name.replace('"', ""),
        offset
    );

    let resp = client
        .post("https://api.igdb.com/v4/games")
        .header("Client-ID", CLIENT_ID)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "text/plain")
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Vec<IGDBGame>>()
        .await
        .map_err(|e| e.to_string())?;

    if resp.is_empty() {
        return Ok(None);
    }

    let game = &resp[0];
    let cover_url = game.cover.as_ref().map(|c| {
        format!(
            "https://images.igdb.com/igdb/image/upload/t_cover_big/{}.jpg",
            c.image_id
        )
    });

    let genre = game
        .genres
        .as_ref()
        .and_then(|g| g.first())
        .map(|g| g.name.clone());

    Ok(Some(GameMetadata {
        name: game.name.clone().unwrap_or(name.to_string()),
        summary: game.summary.clone(),
        genre,
        cover_url,
    }))
}