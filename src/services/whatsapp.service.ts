import { env } from '../config/env.js'
import { formatGs, formatUsd, formatPct } from '../utils/formatters.js'
import type { ComisionesCalculadas } from '../domain/transaction.js'
import type { ResumenHoy, ResumenColaboradorMes } from '../repositories/transaction.repository.js'

class EvolutionClientError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}

async function enviarMensaje(chatId: string, texto: string): Promise<void> {
  const url = `${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.EVOLUTION_API_KEY,
    },
    body: JSON.stringify({ number: chatId, text: texto }),
  })
  if (!res.ok) {
    const body = await res.text()
    if (res.status >= 400 && res.status < 500) {
      throw new EvolutionClientError(res.status, `Evolution API error ${res.status}: ${body}`)
    }
    throw new Error(`Evolution API error ${res.status}: ${body}`)
  }
}

async function enviarMensajeConRetry(chatId: string, texto: string, intentos = 3): Promise<void> {
  for (let i = 0; i < intentos; i++) {
    try {
      await enviarMensaje(chatId, texto)
      return
    } catch (err) {
      if (err instanceof EvolutionClientError) throw err
      if (i === intentos - 1) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// ─── Text builders (exported for logging + UI display) ────────────────────

export function buildMensajeDetallado(c: ComisionesCalculadas): string {
  const lineas = [
    '💸 TRANSACCIÓN CONFIRMADA 💸',
    '',
    `👤 Cliente: ${c.cliente}`,
    `🤝 Colaborador: ${c.colaborador}`,
    '',
    `💵 USD Total: $${formatUsd(c.usdTotal)}`,
    `📉 Comisión: ${formatPct(c.comisionPct)}`,
    `✅ USD Neto (a pagar): $${formatUsd(c.usdNeto)}`,
    '',
    `💱 Tasa usada: ${formatUsd(c.tasaUsada)} Gs/USD`,
    `💰 Monto entregado: ${formatGs(c.montoGs)} Gs`,
  ]

  if (c.porcentajeColaborador > 0) {
    lineas.push(
      '',
      '📊 Distribución de comisiones:',
      `• ${c.colaborador}: $${formatUsd(c.comisionColaboradorUsd)} USD (${formatGs(c.comisionColaboradorGs)} Gs)`,
      `• Gabriel Zambrano: $${formatUsd(c.comisionGabrielUsd)} USD (${formatGs(c.comisionGabrielGs)} Gs)`
    )
  }

  return lineas.join('\n')
}

export function buildMensajeResumen(c: ComisionesCalculadas): string {
  return `${formatUsd(c.usdTotal)}$ - ${formatPct(c.comisionPct)} = ${formatUsd(c.usdNeto)}$ = ${formatGs(c.montoGs)} Gs`
}

export function buildTextoConfirmacionTransaccion(c: ComisionesCalculadas): string {
  return buildMensajeDetallado(c) + '\n\n' + buildMensajeResumen(c)
}

export function buildTextoConfirmacionTasa(tasa: number): string {
  return `✅ Tasa actualizada:\n💲 1 Dólar = ${formatGs(tasa)} Guaraníes 🇵🇾`
}

export function buildTextoResumenHoy(r: ResumenHoy): string {
  const ahora = new Date().toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const lineas = [
    `📊 *RESUMEN DE HOY — ${ahora}*`,
    '',
    `💳 Transacciones: ${r.totalTransacciones}`,
    `💵 USD operado:   $${formatUsd(r.totalUsd)}`,
    `💰 Gs entregados: ${formatGs(r.totalGs)} Gs`,
    `💱 Tasa actual:   ${r.tasaActual ? formatGs(r.tasaActual) + ' Gs/USD' : 'no definida'}`,
  ]

  if (r.porColaborador.length > 1) {
    lineas.push('', '👥 Por colaborador:')
    for (const c of r.porColaborador) {
      lineas.push(`• ${c.colaborador}: ${c.count} tx`)
    }
  }

  lineas.push('', `🏦 Comisión Gabriel: $${formatUsd(r.comisionGabrielUsd)} USD`)
  return lineas.join('\n')
}

export function buildTextoResumenYo(r: ResumenColaboradorMes): string {
  const lineas = [
    `👤 *TUS COMISIONES — ${r.mes.toUpperCase()}*`,
    '',
    `📊 Transacciones: ${r.totalTransacciones}`,
    `💵 USD operado:   $${formatUsd(r.totalUsdOperado)}`,
    '',
    `💰 Tu comisión:`,
    `   $${formatUsd(r.comisionUsd)} USD`,
    `   ${formatGs(r.comisionGs)} Gs`,
  ]

  if (r.totalTransacciones === 0) {
    lineas.push('', '_(sin movimientos este mes)_')
  }

  return lineas.join('\n')
}

// ─── Senders ──────────────────────────────────────────────────────────────

export async function enviarConfirmacionTransaccion(
  chatId: string,
  comisiones: ComisionesCalculadas
): Promise<void> {
  await enviarMensajeConRetry(chatId, buildMensajeDetallado(comisiones))
  await new Promise(r => setTimeout(r, 2000))
  await enviarMensajeConRetry(chatId, buildMensajeResumen(comisiones))
}

export async function enviarConfirmacionTasa(chatId: string, tasa: number): Promise<void> {
  await enviarMensajeConRetry(chatId, buildTextoConfirmacionTasa(tasa))
}

export async function enviarAyuda(chatId: string, texto: string): Promise<void> {
  await enviarMensajeConRetry(chatId, texto)
}

export async function enviarError(chatId: string, mensaje: string): Promise<void> {
  await enviarMensajeConRetry(chatId, `❌ ${mensaje}`)
}

export async function enviarResumenHoy(chatId: string, r: ResumenHoy): Promise<void> {
  await enviarMensajeConRetry(chatId, buildTextoResumenHoy(r))
}

export async function enviarResumenYo(chatId: string, r: ResumenColaboradorMes): Promise<void> {
  await enviarMensajeConRetry(chatId, buildTextoResumenYo(r))
}
