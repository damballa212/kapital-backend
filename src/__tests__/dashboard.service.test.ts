import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMetricasHoyMock = vi.fn()
const getMetricasMesMock = vi.fn()
const getPerformanceColaboradoresMock = vi.fn()
const getTopClientesMock = vi.fn()
const getDailyMetricsMock = vi.fn()
const getCurrentRateMock = vi.fn()

vi.mock('../repositories/transaction.repository.js', () => ({
  getMetricasHoy: getMetricasHoyMock,
  getMetricasMes: getMetricasMesMock,
  getPerformanceColaboradores: getPerformanceColaboradoresMock,
  getTopClientes: getTopClientesMock,
  getDailyMetrics: getDailyMetricsMock,
}))

vi.mock('../repositories/rate.repository.js', () => ({
  getCurrentRate: getCurrentRateMock,
}))

const { obtenerDashboard } = await import('../services/dashboard.service.js')

describe('obtenerDashboard date ranges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMetricasHoyMock.mockResolvedValue({})
    getMetricasMesMock.mockResolvedValue({})
    getPerformanceColaboradoresMock.mockResolvedValue([])
    getTopClientesMock.mockResolvedValue([])
    getDailyMetricsMock.mockResolvedValue([])
    getCurrentRateMock.mockResolvedValue(7300)
  })

  it('uses a semi-open month range for collaborator, top client, and daily metrics', async () => {
    await obtenerDashboard(2026, 6)

    expect(getPerformanceColaboradoresMock).toHaveBeenCalledWith('2026-06-01', '2026-07-01')
    expect(getTopClientesMock).toHaveBeenCalledWith(10, '2026-06-01', '2026-07-01')
    expect(getDailyMetricsMock).toHaveBeenCalledWith('2026-06-01', '2026-07-01')
  })

  it('handles December by moving the exclusive end to January of the next year', async () => {
    await obtenerDashboard(2026, 12)

    expect(getPerformanceColaboradoresMock).toHaveBeenCalledWith('2026-12-01', '2027-01-01')
    expect(getTopClientesMock).toHaveBeenCalledWith(10, '2026-12-01', '2027-01-01')
    expect(getDailyMetricsMock).toHaveBeenCalledWith('2026-12-01', '2027-01-01')
  })
})
