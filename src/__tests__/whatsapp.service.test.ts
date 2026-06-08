import { describe, expect, it } from 'vitest'
import { buildMensajeDetallado } from '../services/whatsapp.service.js'
import type { ComisionesCalculadas } from '../domain/transaction.js'

describe('buildMensajeDetallado', () => {
  it('formats the internal transaction receipt in operational sections', () => {
    const comisiones: ComisionesCalculadas = {
      colaborador: 'Gabriel Zambrano',
      porcentajeColaborador: 0,
      usdNeto: 217.21,
      montoGs: 1303236,
      comisionTotalUsd: 24.13,
      comisionColaboradorUsd: 0,
      comisionGabrielUsd: 24.13,
      comisionColaboradorGs: 0,
      comisionGabrielGs: 144780,
      tasaUsada: 6000,
      cliente: 'Laura Gonzalez',
      usdTotal: 241.34,
      comisionPct: 10,
    }

    expect(buildMensajeDetallado(comisiones)).toBe(`━━━━━━━━━━━━━━━━━━━━
📊 COMPROBANTE DE TRANSACCIÓN
━━━━━━━━━━━━━━━━━━━━

📄 OPERACIÓN
• Cliente: Laura Gonzalez
• Colaborador: Gabriel Zambrano

💵 CÁLCULO
• Importe recibido: $241.34 USD
• Comisión aplicada: 10%
• Neto a pagar: $217.21 USD

💱 LIQUIDACIÓN
• Tasa de cambio: 6.000 Gs/USD
• Monto entregado: 1.303.236 Gs

━━━━━━━━━━━━━━━━━━━━
✅ Operación registrada correctamente.`)
  })
})
