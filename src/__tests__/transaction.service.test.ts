import { describe, it, expect } from 'vitest'
import { resolverColaborador, calcularComisiones } from '../services/transaction.service.js'

describe('resolverColaborador', () => {
  it('null → Gabriel, pct 0', () => {
    expect(resolverColaborador(null, 13, null)).toEqual({ colaborador: 'Gabriel Zambrano', pct: 0 })
  })

  it('Gabriel → pct 0', () => {
    expect(resolverColaborador('gabriel', 13, null)).toEqual({ colaborador: 'Gabriel Zambrano', pct: 0 })
  })

  it('Gabo → pct 0', () => {
    expect(resolverColaborador('Gabo', 13, null)).toEqual({ colaborador: 'Gabriel Zambrano', pct: 0 })
  })

  it('Patty → pct 5 siempre', () => {
    expect(resolverColaborador('Patty', 10, null)).toEqual({ colaborador: 'Patty', pct: 5 })
    expect(resolverColaborador('paty', 15, null)).toEqual({ colaborador: 'Patty', pct: 5 })
  })

  it('Anael + comision 10% → pct 2', () => {
    expect(resolverColaborador('Anael', 10, null)).toEqual({ colaborador: 'Anael', pct: 2 })
  })

  it('Anael + comision 13% → pct 5', () => {
    expect(resolverColaborador('Anael', 13, null)).toEqual({ colaborador: 'Anael', pct: 5 })
  })

  it('Anael + comision 15% → pct 5', () => {
    expect(resolverColaborador('Anael', 15, null)).toEqual({ colaborador: 'Anael', pct: 5 })
  })

  it('Anael + override → usa override', () => {
    expect(resolverColaborador('anel', 13, 3)).toEqual({ colaborador: 'Anael', pct: 3 })
  })

  it('colaborador nuevo con override → usa override', () => {
    expect(resolverColaborador('Carlos', 13, 7)).toEqual({ colaborador: 'Carlos', pct: 7 })
  })

  it('colaborador nuevo sin override → lanza error', () => {
    expect(() => resolverColaborador('Carlos', 13, null)).toThrow()
  })
})

describe('calcularComisiones', () => {
  const base = {
    type: 'TRANSACCION' as const,
    colaborador: 'Anael',
    overridePct: null,
    cliente: 'María González',
    usdTotal: 500,
    comisionPct: 13,
    usdNeto: null,
    montoGs: null,
  }

  it('ejemplo del plan: Anael 500$ 13% tasa 7300', () => {
    const c = calcularComisiones(base, 7300)
    expect(c.usdNeto).toBe(435)
    expect(c.comisionTotalUsd).toBe(65)
    expect(c.comisionColaboradorUsd).toBe(25)
    expect(c.comisionGabrielUsd).toBe(40)
    expect(c.montoGs).toBe(3175500)
    expect(c.comisionColaboradorGs).toBe(182500)
    expect(c.comisionGabrielGs).toBe(292000)
  })

  it('sin colaborador → Gabriel recibe todo', () => {
    const c = calcularComisiones({ ...base, colaborador: null }, 7300)
    expect(c.colaborador).toBe('Gabriel Zambrano')
    expect(c.comisionColaboradorUsd).toBe(0)
    expect(c.comisionGabrielUsd).toBe(65)
  })

  it('Patty siempre 5%', () => {
    const c = calcularComisiones({ ...base, colaborador: 'Patty', comisionPct: 10 }, 7300)
    expect(c.porcentajeColaborador).toBe(5)
    expect(c.comisionColaboradorUsd).toBe(25)
  })
})
