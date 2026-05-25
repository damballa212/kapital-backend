import { env } from '../config/env.js'
import { formatGs, formatUsd, formatPct } from '../utils/formatters.js'
import type { ComisionesCalculadas } from '../domain/transaction.js'
import type { ResumenHoy, ResumenColaboradorMes } from '../repositories/transaction.repository.js'

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
    throw new Error(`Evolution API error ${res.status}: ${await res.text()}`)
  }
}

function mensajeDetallado(c: ComisionesCalculadas): string {
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

function mensajeResumen(c: ComisionesCalculadas): string {
  return `${formatUsd(c.usdTotal)}$ - ${formatPct(c.comisionPct)} = ${formatUsd(c.usdNeto)}$ = ${formatGs(c.montoGs)} Gs`
}

export async function enviarConfirmacionTransaccion(
  chatId: string,
  comisiones: ComisionesCalculadas
): Promise<void> {
  await enviarMensaje(chatId, mensajeDetallado(comisiones))
  // Pequeño delay antes del resumen (Evolution API lo puede manejar con delay param,
  // pero lo hacemos secuencial para simplicidad en serverless)
  await new Promise(r => setTimeout(r, 2000))
  await enviarMensaje(chatId, mensajeResumen(comisiones))
}

export async function enviarConfirmacionTasa(chatId: string, tasa: number): Promise<void> {
  await enviarMensaje(chatId, `✅ Tasa actualizada:\n💲 1 Dólar = ${formatGs(tasa)} Guaraníes 🇵🇾`)
}

export async function enviarError(chatId: string, mensaje: string): Promise<void> {
  await enviarMensaje(chatId, `❌ ${mensaje}`)
}

export async function enviarResumenHoy(chatId: string, r: ResumenHoy): Promise<void> {
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

  await enviarMensaje(chatId, lineas.join('\n'))
}

export async function enviarResumenYo(chatId: string, r: ResumenColaboradorMes): Promise<void> {
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

  await enviarMensaje(chatId, lineas.join('\n'))
}
