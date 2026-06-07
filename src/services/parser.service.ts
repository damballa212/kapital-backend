import type { ParseResult } from '../domain/webhook.js'

const TASA_RE = /#TASA\s+(\d+(?:[.,]\d+)?)/i
const TX_RE = /^#TRANSACCION\s+(?:Colaborador\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)(?:\s*\(%?(\d+(?:\.\d+)?)%?\))?\s+)?Cliente\s+([\w\sáéíóúüñÁÉÍÓÚÜÑ]+?)\s*(?::\s*|\s+)\$?([\d.,]+)\$?\s*-\s*([\d.,]+)%(?:\s*=\s*\$?([\d.,]+))?(?:\s*=\s*([\d.,]+)\s*Gs)?/i

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

export const AYUDA_MSG = `📋 *COMANDOS DISPONIBLES*

💱 *Actualizar tasa:*
#TASA [monto]
Ej: #TASA 7300

💸 *Registrar transacción:*
#TRANSACCION Cliente [nombre]: [monto]$ - [%]

Ejemplos:
• #TRANSACCION Cliente María: 500$ - 15%
• #TRANSACCION Cliente Juan Pérez: 1.200$ - 13%
• #TRANSACCION Cliente Alvaro Torales 76,21$ - 15%

Con colaborador:
• #TRANSACCION Colaborador Patty Cliente Ana: 300$ - 15%
• #TRANSACCION Colaborador Anael(3%) Cliente Luis: 800$ - 15%

📊 *Ver resumen del día:*
#HOY

👤 *Ver tu resumen del mes:*
#YO

Enviá *#AYUDA* en cualquier momento para ver esto.`

export function parsearMensaje(content: string): ParseResult {
  const trimmed = content.trim()

  if (trimmed.toUpperCase() === '#AYUDA') {
    return { type: 'AYUDA' }
  }

  if (trimmed.toUpperCase() === '#HOY') {
    return { type: 'HOY' }
  }

  if (trimmed.toUpperCase() === '#YO') {
    return { type: 'YO' }
  }

  const tasaMatch = TASA_RE.exec(trimmed)
  if (tasaMatch) {
    const tasa = parseNum(tasaMatch[1])
    if (isNaN(tasa) || tasa <= 0) {
      return { type: 'ERROR', mensaje: 'La tasa ingresada no es válida.\n\nFormato correcto:\n#TASA [número]\n\nEjemplo: #TASA 7300' }
    }
    return { type: 'TASA', tasa }
  }

  const txMatch = TX_RE.exec(trimmed)
  if (txMatch) {
    const [, colaborador, overridePctStr, cliente, usdTotalStr, comisionPctStr, usdNetoStr, montoGsStr] = txMatch

    const usdTotal = parseNum(usdTotalStr)
    const comisionPct = parseNum(comisionPctStr)

    if (isNaN(usdTotal) || usdTotal <= 0) {
      return { type: 'ERROR', mensaje: 'El monto en USD no es válido.\n\nEjemplo correcto:\n#TRANSACCION Cliente María: 500$ - 15%' }
    }
    if (isNaN(comisionPct) || comisionPct < 0 || comisionPct > 100) {
      return { type: 'ERROR', mensaje: 'El porcentaje de comisión no es válido (debe ser entre 0 y 100).\n\nEjemplo correcto:\n#TRANSACCION Cliente María: 500$ - 15%' }
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
    return {
      type: 'ERROR',
      mensaje: 'Formato de tasa incorrecto.\n\nCorrecto:\n#TASA [número]\n\nEjemplo: #TASA 7300',
    }
  }
  if (trimmed.toUpperCase().startsWith('#TRANSACCION')) {
    return {
      type: 'ERROR',
      mensaje: `Formato de transacción incorrecto.\n\nFormatos válidos:\n• #TRANSACCION Cliente [nombre]: [monto]$ - [%]\n• #TRANSACCION Cliente [nombre] [monto]$ - [%]\n• #TRANSACCION Colaborador [nombre] Cliente [nombre]: [monto]$ - [%]\n• #TRANSACCION Colaborador [nombre] Cliente [nombre] [monto]$ - [%]\n• Con porcentaje override: Colaborador Anael(3%)\n\nEjemplos:\n• #TRANSACCION Cliente Ana: 500$ - 15%\n• #TRANSACCION Cliente Alvaro Torales 76,21$ - 15%\n• #TRANSACCION Colaborador Patty Cliente Juan: 300$ - 13%\n\nEnviá #AYUDA para ver todos los formatos.`,
    }
  }

  return {
    type: 'ERROR',
    mensaje: `Comando no reconocido: "${trimmed.slice(0, 20)}"\n\nComandos disponibles:\n• #TASA\n• #TRANSACCION\n• #HOY\n• #YO\n• #AYUDA`,
  }
}
