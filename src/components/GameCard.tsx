import { useState } from 'react'
import { Game } from '../types'
import { convertFileSrc } from '@tauri-apps/api/core'

interface Props {
  game: Game
  isSelected: boolean
  isRunning: boolean
  onClick: () => void
  onDoubleClick: () => void
}

export default function GameCard({ game, isSelected, isRunning, onClick, onDoubleClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const hasCover = game.coverPath && !imgError
  
  const isSteam = game.exePath.startsWith('steam://')
  const isEpic = game.exePath.startsWith('com.epicgames')

  const canPlay = game.isInstalled
  const canInstall = !game.isInstalled && isSteam
  const isClickable = canPlay || canInstall

  return (
    <div
      style={{
        background: '#151820',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: isClickable ? 'pointer' : 'not-allowed',
        height: '250px',
        flexShrink: 0,
        opacity: game.isInstalled ? 1 : 0.45,
        filter: game.isInstalled ? 'none' : 'grayscale(100%)',
        border: isSelected
          ? '2px solid #4f8ef7'
          : hovered && isClickable
          ? '2px solid rgba(79, 142, 247, 0.4)'
          : '2px solid rgba(255,255,255,0.06)',
        transform: hovered && !isSelected && isClickable ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(79, 142, 247, 0.2)'
          : hovered && isClickable
          ? '0 8px 24px rgba(0,0,0,0.4)'
          : 'none',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        height: '190px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: isRunning ? '#0f2a1a' : '#1c2030',
        overflow: 'hidden',
      }}>
        {hasCover ? (
          <img
            src={game.coverPath?.startsWith('http') ? game.coverPath : convertFileSrc(game.coverPath?.replace(/\\/g, '/') ?? '') + '?t=' + Date.now()}
            alt={game.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.2s ease',
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{
            fontSize: '36px',
            transform: hovered ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.15s ease',
            display: 'block',
          }}>🎮</span>
        )}

        {game.isFavorite && (
          <span style={{
            position: 'absolute',
            top: '6px',
            left: '8px',
            color: '#f59e0b',
            fontSize: '12px',
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}>♥</span>
        )}

        {isRunning && (
          <span style={{
            position: 'absolute',
            top: '6px',
            right: '8px',
            color: '#22c55e',
            fontSize: '10px',
          }}>●</span>
        )}

        {hovered && !isRunning && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '11px',
              color: game.isInstalled ? 'rgba(255,255,255,0.9)' : (canInstall ? '#4f8ef7' : '#ef4444'),
              letterSpacing: '3px',
              fontFamily: 'Segoe UI, sans-serif',
              fontWeight: 700,
            }}>
              {game.isInstalled ? 'JOGAR' : (canInstall ? 'INSTALAR' : 'NÃO ENCONTRADO')}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: '12px',
            fontWeight: 600,
            color: hovered ? '#ffffff' : '#e8eaf0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color 0.15s ease',
          }}>
            {game.name}
          </p>
          <p style={{
            fontSize: '10px',
            color: isRunning ? '#22c55e' : '#6b7280',
            marginTop: '2px',
          }}>
            {isRunning ? '● Rodando' : game.genre}
          </p>
        </div>
        <div style={{ flexShrink: 0, paddingLeft: '8px' }}>
          {isSteam && <span style={{ background: '#171a21', color: '#c7d5e0', padding: '3px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, letterSpacing: '1px' }}>STEAM</span>}
          {isEpic && <span style={{ background: '#2a2a2a', color: '#ffffff', padding: '3px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, letterSpacing: '1px' }}>EPIC</span>}
        </div>
      </div>
    </div>
  )
}