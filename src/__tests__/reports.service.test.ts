import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../domain/transaction.js'

const findTransactionsForExportMock = vi.fn()

vi.mock('../repositories/transaction.repository.js', () => ({
  findTransactionsForExport: findTransactionsForExportMock,
}))

const { generarCSV, generarPDF } = await import('../services/reports.service.js')

const baseTransaction: Transaction = {
  id: 1,
  idempotencyKey: 'key-1',
  fecha: new Date('2026-05-20T10:00:00.000Z'),
  chatId: '595981000000@s.whatsapp.net',
  colaborador: 'Anael',
  cliente: 'Cliente "Especial", SA',
  usdTotal: 500,
  comision: 13,
  usdNeto: 435,
  montoGs: 3175500,
  montoColaboradorGs: 182500,
  montoColaboradorUsd: 25,
  montoComisionGabrielGs: 292000,
  montoComisionGabrielUsd: 40,
  tasaUsada: 7300,
  observaciones: 'Primera linea\nSegunda linea',
}

describe('generarCSV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('escapes commas, quotes, and newlines according to CSV rules', async () => {
    findTransactionsForExportMock.mockResolvedValue([baseTransaction])

    const csv = await generarCSV({
      fields: ['cliente', 'observaciones'],
    })

    expect(csv).toBe([
      'Cliente,Observaciones',
      '"Cliente ""Especial"", SA","Primera linea\nSegunda linea"',
    ].join('\n'))
  })
})

describe('generarPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generates a valid PDF without loading the raster logo asset', async () => {
    findTransactionsForExportMock.mockResolvedValue([baseTransaction])

    const pdf = await generarPDF({
      fields: ['fecha', 'cliente', 'usd_total'],
    })

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(1000)
  })
})
