import { useState, useRef, useCallback } from 'react'
import { Game, SessionInfo } from '../types'
import {
  launchGame as apiLaunchGame,
  isProcessRunning,
  closeSession,
  getGamePlaytime,
  getGameSessions,
} from '../api/games'

export function useGameSession(onSessionEnd: () => void) {
  const [runningPid, setRunningPid] = useState<number | null>(null)
  const [runningGameId, setRunningGameId] = useState<number | null>(null)
  const [playtime, setPlaytime] = useState<number>(0)
  const [sessions, setSessions] = useState<SessionInfo[]>([])

  const runningPidRef = useRef<number | null>(null)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadPlaytime = useCallback(async (gameId: number) => {
    const seconds = await getGamePlaytime(gameId)
    setPlaytime(seconds)
  }, [])

  const loadSessions = useCallback(async (gameId: number) => {
    const result = await getGameSessions(gameId)
    setSessions(result)
  }, [])

  const startMonitor = useCallback((pid: number, gameId: number) => {
    if (monitorRef.current) clearInterval(monitorRef.current)
    monitorRef.current = setInterval(async () => {
      const running = await isProcessRunning(pid)
      if (!running) {
        clearInterval(monitorRef.current!)
        await closeSession(gameId)
        runningPidRef.current = null
        setRunningPid(null)
        setRunningGameId(null)
        onSessionEnd()
      }
    }, 3000)
  }, [onSessionEnd])

  const launchGame = useCallback(async (game: Game) => {
    if (runningPidRef.current) return
    try {
      const pid = await apiLaunchGame(Number(game.id))
      runningPidRef.current = pid
      setRunningPid(pid)
      setRunningGameId(Number(game.id))
      startMonitor(pid, Number(game.id))
    } catch (e) {
      alert(String(e))
    }
  }, [startMonitor])

  return {
    runningPid,
    runningGameId,
    runningPidRef,
    playtime,
    sessions,
    launchGame,
    loadPlaytime,
    loadSessions,
  }
}
