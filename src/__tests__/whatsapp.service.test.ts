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

  it('shows collaborator and Gabriel commission split when the collaborator earns commission', () => {
    const comisiones: ComisionesCalculadas = {
      colaborador: 'Anael',
      porcentajeColaborador: 5,
      usdNeto: 30.06,
      montoGs: 180387,
      comisionTotalUsd: 5.31,
      comisionColaboradorUsd: 1.77,
      comisionGabrielUsd: 3.54,
      comisionColaboradorGs: 10611,
      comisionGabrielGs: 21246,
      tasaUsada: 6000,
      cliente: 'Marcos Vazquez',
      usdTotal: 35.37,
      comisionPct: 15,
    }

    const mensaje = buildMensajeDetallado(comisiones)

    expect(mensaje).toContain('📊 DISTRIBUCIÓN DE COMISIONES')
    expect(mensaje).toContain('• Anael: $1.77 USD (10.611 Gs)')
    expect(mensaje).toContain('• Gabriel Zambrano: $3.54 USD (21.246 Gs)')
  })
})
