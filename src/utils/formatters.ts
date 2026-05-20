export function formatGs(n: number): string {
  return Math.round(n).toLocaleString('es-PY').replace(/,/g, '.')
}

export function formatUsd(n: number): string {
  return n.toFixed(2)
}

export function formatPct(n: number): string {
  return `${n.toFixed(2)}%`
}
