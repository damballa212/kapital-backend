import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

const crearColaboradorMock = vi.fn()
const actualizarColaboradorMock = vi.fn()
const eliminarColaboradorMock = vi.fn()

vi.mock('../services/collaborator.service.js', () => ({
  listarColaboradores: vi.fn(),
  crearColaborador: crearColaboradorMock,
  actualizarColaborador: actualizarColaboradorMock,
  eliminarColaborador: eliminarColaboradorMock,
}))

const { handleCreateColaborador, handleUpdateColaborador, handleDeleteColaborador } = await import('../handlers/collaborators.handler.js')

function makeRes(): Response {
  return {
    status: vi.fn(function status(this: Response) {
      return this
    }),
    json: vi.fn(function json(this: Response) {
      return this
    }),
    sendStatus: vi.fn(),
  } as unknown as Response
}

describe('collaborators handlers error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not expose internal create errors', async () => {
    crearColaboradorMock.mockRejectedValue(new Error('database password leaked'))
    const res = makeRes()

    await handleCreateColaborador({ body: { name: 'Carlos', basePct: 5 } } as Request, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Error creando colaborador' })
  })

  it('does not expose internal update errors', async () => {
    actualizarColaboradorMock.mockRejectedValue(new Error('connection string leaked'))
    const res = makeRes()

    await handleUpdateColaborador({ params: { id: '1' }, body: { name: 'Carlos' } } as unknown as Request, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Error actualizando colaborador' })
  })

  it('does not expose internal delete errors', async () => {
    eliminarColaboradorMock.mockRejectedValue(new Error('sql stack trace'))
    const res = makeRes()

    await handleDeleteColaborador({ params: { id: '1' } } as unknown as Request, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Error eliminando colaborador' })
  })
})
