import { beforeEach, describe, expect, it, vi } from 'vitest'

const beginMock = vi.fn()
const insertTransactionMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  sql: {
    begin: beginMock,
  },
}))

vi.mock('../repositories/transaction.repository.js', () => ({
  insertTransaction: insertTransactionMock,
}))

vi.mock('../repositories/collaborator.repository.js', () => ({
  findCollaboratorByName: vi.fn().mockResolvedValue(null),
  upsertCollaborator: vi.fn().mockResolvedValue(undefined),
  incrementCollaboratorCount: vi.fn().mockResolvedValue(undefined),
  findAllCollaborators: vi.fn().mockResolvedValue([]),
  createCollaborator: vi.fn(),
  updateCollaboratorById: vi.fn(),
  deleteCollaboratorById: vi.fn(),
}))

const { procesarTransaccion } = await import('../services/transaction.service.js')

describe('procesarTransaccion persistence metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beginMock.mockImplementation(async (cb) => {
      const tx = vi.fn()
      await cb(tx)
    })
    insertTransactionMock.mockResolvedValue(42)
  })

  it('returns the created transaction id for webhook tracing', async () => {
    const result = await procesarTransaccion({
      type: 'TRANSACCION',
      colaborador: 'Anael',
      overridePct: null,
      cliente: 'Cliente Test',
      usdTotal: 100,
      comisionPct: 10,
      usdNeto: null,
      montoGs: null,
    }, {
      chatId: '595981000000@s.whatsapp.net',
      content: '#TRANSACCION Anael Cliente Test 100 10%',
      messageId: 'MSG-1',
      timestamp: '1710000000',
      userName: 'Operador',
    }, 7300)

    expect(result.transactionId).toBe(42)
  })

  it('persists Gabriel Zambrano when the transaction omits collaborator', async () => {
    await procesarTransaccion({
      type: 'TRANSACCION',
      colaborador: null,
      overridePct: null,
      cliente: 'Ana Martinez',
      usdTotal: 500,
      comisionPct: 15,
      usdNeto: null,
      montoGs: null,
    }, {
      chatId: '595971525301@s.whatsapp.net',
      content: '#TRANSACCION Cliente Ana Martinez: 500$ - 15%',
      messageId: 'MSG-DEFAULT-GABRIEL',
      timestamp: '1710000001',
      userName: 'Gabriel Zambrano',
    }, 5900)

    expect(insertTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ colaborador: 'Gabriel Zambrano' }),
      expect.any(Function)
    )
  })
})
