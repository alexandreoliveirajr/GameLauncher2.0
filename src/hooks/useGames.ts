import { useState, useRef, useEffect, useCallback } from 'react'
import { Game } from '../types'
import { listGames, getGamePlaytime } from '../api/games'
import { useSettings } from '../store/SettingsContext'
import { invoke } from '@tauri-apps/api/core'

type Filter = 'all' | 'favorites' | string
type SortBy = 'name' | 'playtime' | 'recent'

export function useGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [playtimeMap, setPlaytimeMap] = useState<Record<number, number>>({})
  
  const { settings, setShowUninstalled } = useSettings()
  const showUninstalled = settings.showUninstalled

  const gamesRef = useRef<Game[]>([])

  const genres = [...new Set(games.map(g => g.genre).filter(Boolean))].sort()

  const filtered = games
    .filter(g => {
      if (!showUninstalled && !g.isInstalled) return false
      if (search) return g.name.toLowerCase().includes(search.toLowerCase())
      if (filter === 'all') return true
      if (filter === 'favorites') return g.isFavorite
      return g.genre === filter
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'recent') {
        const dateA = a.lastPlayedAt ?? a.addedAt
        const dateB = b.lastPlayedAt ?? b.addedAt
        return dateB.localeCompare(dateA)
      }
      if (sortBy === 'playtime') {
        const pa = playtimeMap[Number(a.id)] ?? 0
        const pb = playtimeMap[Number(b.id)] ?? 0
        return pb - pa
      }
      return 0
    })

  const loadGames = useCallback(async () => {
    try {
      const result = await listGames()
      gamesRef.current = result
      setGames(result)
    } catch (e) {
      console.error('Erro ao carregar jogos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // 1. Carrega instantaneamente os jogos do DB (zero peso, tela imediata)
    loadGames()

    // 2. Manda o Rust varrer a Steam e Epic em uma thread oculta
    invoke('auto_import_store_games')
      .then((importedCount) => {
        if (Number(importedCount) > 0) {
          console.log(`[Auto-Import] ${importedCount} jogos encontrados e vinculados!`)
          loadGames()
        }
      })
      .catch(err => console.error('[Auto-Import] Erro na varredura silenciosa:', err))
  }, [loadGames])

  useEffect(() => {
    async function loadAllPlaytimes() {
      const map: Record<number, number> = {}
      for (const game of games) {
        const seconds = await getGamePlaytime(Number(game.id))
        map[Number(game.id)] = seconds
      }
      setPlaytimeMap(map)
    }
    if (games.length > 0) loadAllPlaytimes()
  }, [games])

  return {
    games,
    gamesRef,
    filtered,
    loading,
    filter,
    setFilter,
    search,
    setSearch,
    sortBy,
    setSortBy,
    showUninstalled,
    setShowUninstalled,
    playtimeMap,
    genres,
    loadGames,
  }
}
