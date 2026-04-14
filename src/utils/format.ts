/**
 * Formata segundos em string legível (ex: "2h 14min", "30min", "45s")
 */
export function formatPlaytime(seconds: number): string {
  if (seconds === 0) return '0min'
  if (seconds < 60) return `${seconds}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}min`
  return `${hours}h ${minutes}min`
}

/**
 * Formata uma string de data ISO/SQLite em formato pt-BR (ex: "13/04/2026")
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const normalized = dateStr.length === 10
    ? dateStr + 'T12:00:00'
    : dateStr.replace(' ', 'T')
  const d = new Date(normalized)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}
