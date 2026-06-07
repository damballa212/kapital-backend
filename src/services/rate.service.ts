import { insertRate, getCurrentRate } from '../repositories/rate.repository.js'
export async function setTasa(tasa: number): Promise<number> {
  await insertRate(tasa)
  return tasa
}

export async function getTasaVigente(): Promise<number> {
  const rate = await getCurrentRate()
  if (rate === null) throw new Error('No hay tasa configurada. Use #TASA para establecerla.')
  return rate
}
