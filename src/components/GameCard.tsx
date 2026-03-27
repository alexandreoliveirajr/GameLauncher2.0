import { useState } from 'react'
import { Game } from '../types'

interface Props {
  game: Game
  isSelected: boolean
  isRunning: boolean
  onClick: () => void
  onDoubleClick: () => void
}

export default function GameCard({ game, isSelected, isRunning, onClick, onDoubleClick }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        background: '#151820',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        height: '148px',
        flexShrink: 0,
        border: isSelected
          ? '2px solid #4f8ef7'
          : hovered
          ? '2px solid rgba(79, 142, 247, 0.4)'
          : '2px solid rgba(255,255,255,0.06)',
        transform: hovered && !isSelected ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
        boxShadow: isSelected
          ? '0 0 0 1px rgba(79, 142, 247, 0.2)'
          : hovered
          ? '0 8px 24px rgba(0,0,0,0.4)'
          : 'none',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        height: '96px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: isRunning
          ? '#0f2a1a'
          : hovered
          ? '#232840'
          : '#1c2030',
        transition: 'background 0.15s ease',
      }}>
        <span style={{
          fontSize: '28px',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.15s ease',
          display: 'block',
        }}>🎮</span>

        {game.isFavorite && (
          <span style={{
            position: 'absolute',
            top: '6px',
            left: '8px',
            color: '#f59e0b',
            fontSize: '10px',
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
            background: 'rgba(79, 142, 247, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '11px',
              color: 'rgba(79, 142, 247, 0.8)',
              letterSpacing: '2px',
              fontFamily: 'Segoe UI, sans-serif',
              marginTop: '32px',
            }}>
              JOGAR
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 10px' }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 500,
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
    </div>
  )
}