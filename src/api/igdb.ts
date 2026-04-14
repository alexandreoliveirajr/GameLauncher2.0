import { invoke } from '@tauri-apps/api/core'

export const searchIGDB = (name: string) =>
  invoke<unknown>('search_igdb', { name })

export const searchIGDBPreview = (name: string, offset: number) =>
  invoke<unknown>('search_igdb_preview', { name, offset })

export const fetchIGDBCover = (gameId: number, gameName: string) =>
  invoke<string | null>('fetch_igdb_cover', { gameId, gameName })

export const saveIGDBData = (
  gameId: number,
  coverUrl: string | null,
  summary: string | null,
  genre: string | null
) =>
  invoke<string | null>('save_igdb_data', { gameId, coverUrl, summary, genre })
