import {
  getMetricasHoy,
  getMetricasMes,
  getPerformanceColaboradores,
  getTopClientes,
  getDailyMetrics,
} from '../repositories/transaction.repository.js'
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
}

export async function obtenerDashboard(year: number, month: number): Promise<DashboardData> {
  const inicio = `${year}-${String(month).padStart(2, '0')}-01`
  const fin = new Date(year, month, 0).toISOString().split('T')[0]

  const [hoy, mes, colaboradores, topClientes, diario] = await Promise.all([
    getMetricasHoy(),
    getMetricasMes(year, month),
    getPerformanceColaboradores(inicio, fin),
    getTopClientes(10),
    getDailyMetrics(inicio, fin),
  ])

  return { hoy, mes, colaboradores, topClientes, diario }
}
