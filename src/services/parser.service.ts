import type { ParseResult } from '../domain/webhook.js'

const TASA_RE = /#TASA\s+(\d+(?:[.,]\d+)?)/i
const TX_RE = /^#TRANSACCION\s+(?:Colaborador\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)(?:\s*\((\d+(?:\.\d+)?)%\))?\s+)?Cliente\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)\s*:\s*\$?([\d.,]+)\$?\s*-\s*([\d.,]+)%(?:\s*=\s*\$?([\d.,]+))?(?:\s*=\s*([\d.,]+)\s*Gs)?/i

function parseNum(s: string): number {
  // Acepta "1.500", "7.300", "1500", "7300.50", "1.500,50", "1500.50"
  let clean = s.trim()
  if (clean.includes(',') && clean.includes('.')) {
    // Ambos presentes: el punto es miles, la coma es decimal → "1.500,50" → 1500.50
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (clean.includes(',')) {
    // Solo coma: separador decimal → "7300,50" → 7300.50
    clean = clean.replace(',', '.')
  } else if (clean.includes('.')) {
    // Solo punto: miles si hay exactamente 3 dígitos tras él, decimal en otro caso
    // "7.300" → 7300  |  "7300.50" → 7300.50
    const parts = clean.split('.')
    if (parts.length === 2 && parts[1].length === 3) {
      clean = clean.replace('.', '')
    }
  }
  return parseFloat(clean)
}

export function parsearMensaje(content: string): ParseResult {
  const trimmed = content.trim()

  const tasaMatch = TASA_RE.exec(trimmed)
  if (tasaMatch) {
    const tasa = parseNum(tasaMatch[1])
    if (isNaN(tasa) || tasa <= 0) {
      return { type: 'ERROR', mensaje: 'Tasa inválida. Ejemplo: #TASA 7300' }
    }
    return { type: 'TASA', tasa }
  }

  const txMatch = TX_RE.exec(trimmed)
  if (txMatch) {
    const [, colaborador, overridePctStr, cliente, usdTotalStr, comisionPctStr, usdNetoStr, montoGsStr] = txMatch

    const usdTotal = parseNum(usdTotalStr)
    const comisionPct = parseNum(comisionPctStr)

    if (isNaN(usdTotal) || usdTotal <= 0) {
      return { type: 'ERROR', mensaje: 'Monto USD inválido.' }
    }
    if (isNaN(comisionPct) || comisionPct < 0 || comisionPct > 100) {
      return { type: 'ERROR', mensaje: 'Porcentaje de comisión inválido.' }
    }

    return {
      type: 'TRANSACCION',
      colaborador: colaborador?.trim() ?? null,
      overridePct: overridePctStr ? parseFloat(overridePctStr) : null,
      cliente: cliente.trim(),
      usdTotal,
      comisionPct,
      usdNeto: usdNetoStr ? parseNum(usdNetoStr) : null,
      montoGs: montoGsStr ? parseNum(montoGsStr) : null,
    }
  }

  if (trimmed.toUpperCase().startsWith('#TASA')) {
    return { type: 'ERROR', mensaje: 'Formato incorrecto. Ejemplo: #TASA 7300' }
  }
  if (trimmed.toUpperCase().startsWith('#TRANSACCION')) {
    return {
      type: 'ERROR',
      mensaje: 'Formato incorrecto. Ejemplos:\n#TRANSACCION Cliente María: 500$ - 13%\n#TRANSACCION Colaborador Patty Cliente Juan: 500$ - 13%',
    }
  }

  return { type: 'ERROR', mensaje: '❌ Comando no reconocido. Use #TASA o #TRANSACCION.' }
}
