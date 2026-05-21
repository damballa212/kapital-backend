export type ComisionesCalculadas = {
  colaborador: string
  porcentajeColaborador: number
  usdNeto: number
  montoGs: number
  comisionTotalUsd: number
  comisionColaboradorUsd: number
  comisionGabrielUsd: number
  comisionColaboradorGs: number
  comisionGabrielGs: number
  tasaUsada: number
  cliente: string
  usdTotal: number
  comisionPct: number
}

export type Transaction = {
  id: number
  idempotencyKey: string
  fecha: Date
  chatId: string
  colaborador: string | null
  cliente: string
  usdTotal: number
  comision: number
  usdNeto: number
  montoGs: number
  montoColaboradorGs: number
  montoColaboradorUsd: number
  montoComisionGabrielGs: number
  montoComisionGabrielUsd: number
  tasaUsada: number
  observaciones: string | null
}

export type TransactionInsert = Omit<Transaction, 'id'>

export type FiltroTransacciones = {
  startDate?: string
  endDate?: string
  colaborador?: string
  cliente?: string
  page: number
  limit: number
}

export type FiltroReporte = {
  startDate?: string
  endDate?: string
  colaborador?: string
  cliente?: string
  minAmount?: number
  maxAmount?: number
  fields?: string[]
}

export type MetricasHoy = {
  totalTransacciones: number
  totalUsd: number
  totalGs: number
  comisionGabrielUsd: number
  comisionGabrielGs: number
}

export type MetricasMes = MetricasHoy & {
  year: number
  month: number
}

export type ColaboradorMetrica = {
  colaborador: string
  totalTransacciones: number
  totalUsd: number
  comisionUsd: number
}

export type ClienteMetrica = {
  cliente: string
  totalTransacciones: number
  totalUsd: number
}

export type DiaMetrica = {
  fecha: string
  totalTransacciones: number
  totalUsd: number
}
