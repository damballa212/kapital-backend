import {
  getMetricasHoy,
  getMetricasMes,
  getPerformanceColaboradores,
  getTopClientes,
  getDailyMetrics,
} from '../repositories/transaction.repository.js'
import { getCurrentRate } from '../repositories/rate.repository.js'
import type {
  MetricasHoy,
  MetricasMes,
  ColaboradorMetrica,
  ClienteMetrica,
  DiaMetrica,
} from '../domain/transaction.js'

export async function obtenerMetricasHoy(): Promise<MetricasHoy> {
  return getMetricasHoy()
}

export async function obtenerMetricasMes(year: number, month: number): Promise<MetricasMes> {
  return getMetricasMes(year, month)
}

export type DashboardData = {
  hoy: MetricasHoy
  mes: MetricasMes
  colaboradores: ColaboradorMetrica[]
  topClientes: ClienteMetrica[]
  diario: DiaMetrica[]
  tasaActual: number | null
}

function monthRange(year: number, month: number): { inicio: string; finExclusivo: string } {
  const safeMonth = Math.min(12, Math.max(1, month))
  const inicio = `${year}-${String(safeMonth).padStart(2, '0')}-01`
  const nextYear = safeMonth === 12 ? year + 1 : year
  const nextMonth = safeMonth === 12 ? 1 : safeMonth + 1
  const finExclusivo = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { inicio, finExclusivo }
}

export async function obtenerDashboard(year: number, month: number): Promise<DashboardData> {
  const { inicio, finExclusivo } = monthRange(year, month)

  const [hoy, mes, colaboradores, topClientes, diario, tasaActual] = await Promise.all([
    getMetricasHoy(),
    getMetricasMes(year, month),
    getPerformanceColaboradores(inicio, finExclusivo),
    getTopClientes(10, inicio, finExclusivo),
    getDailyMetrics(inicio, finExclusivo),
    getCurrentRate(),
  ])

  return { hoy, mes, colaboradores, topClientes, diario, tasaActual }
}
