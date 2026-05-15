import { useState, useRef, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'

interface UseGamepadOptions {
  /** Callback quando dpad_right ou dpad_down é pressionado */
  onNext?: () => void
  /** Callback quando dpad_left ou dpad_up é pressionado */
  onPrev?: () => void
  /** Callback quando confirm (A) é pressionado */
  onConfirm?: () => void
  /** Callback quando favorite (Y) é pressionado */
  onFavorite?: () => void
  /** Callback quando back (B) é pressionado */
  onBack?: () => void
  /** Callback quando bumper esquerdo é pressionado */
  onBumperLeft?: () => void
  /** Callback quando bumper direito é pressionado */
  onBumperRight?: () => void
}

export function useGamepad(options: UseGamepadOptions = {}) {
  const [showExit, setShowExit] = useState(false)
  const showExitRef = useRef(false)
  const startHeldRef = useRef(false)
  const selectHeldRef = useRef(false)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    showExitRef.current = showExit
  }, [showExit])

  // Abre o menu de saída com Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault() // Impede que o Chromium saia do fullscreen
        setShowExit(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    listen('gamepad_input', (event: { payload: string }) => {
      const action = event.payload

      // Combo START + SELECT por 2s abre o menu de saída
      if (action === 'menu') {
        startHeldRef.current = true
        if (selectHeldRef.current) {
          comboTimerRef.current = setTimeout(() => setShowExit(true), 2000)
        }
      }
      if (action === 'menu_release') {
        startHeldRef.current = false
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      }
      if (action === 'select') {
        selectHeldRef.current = true
        if (startHeldRef.current) {
          comboTimerRef.current = setTimeout(() => setShowExit(true), 2000)
        }
      }
      if (action === 'select_release') {
        selectHeldRef.current = false
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      }

      if (showExitRef.current) return

      if (action === 'dpad_right' || action === 'dpad_down') options.onNext?.()
      if (action === 'dpad_left' || action === 'dpad_up') options.onPrev?.()
      if (action === 'confirm') options.onConfirm?.()
      if (action === 'favorite') options.onFavorite?.()
      if (action === 'back') options.onBack?.()
      if (action === 'bumper_left') options.onBumperLeft?.()
      if (action === 'bumper_right') options.onBumperRight?.()
    }).then(fn => { unlisten = fn })

    return () => { if (unlisten) unlisten() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExit])

  return { showExit, setShowExit }
}
