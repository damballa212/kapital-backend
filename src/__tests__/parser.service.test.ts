import { describe, it, expect } from 'vitest'
import { parsearMensaje } from '../services/parser.service.js'

describe('parsearMensaje — #TASA', () => {
  it('parsea tasa entera', () => {
    const r = parsearMensaje('#TASA 7300')
    expect(r).toEqual({ type: 'TASA', tasa: 7300 })
  })

  it('parsea tasa con punto decimal', () => {
    const r = parsearMensaje('#TASA 7300.50')
    expect(r).toEqual({ type: 'TASA', tasa: 7300.5 })
  })

  it('parsea tasa con coma decimal', () => {
    const r = parsearMensaje('#TASA 7300,50')
    expect(r).toEqual({ type: 'TASA', tasa: 7300.5 })
  })

  it('error si falta número', () => {
    const r = parsearMensaje('#TASA')
    expect(r.type).toBe('ERROR')
  })
})

describe('parsearMensaje — #TRANSACCION', () => {
  it('sin colaborador', () => {
    const r = parsearMensaje('#TRANSACCION Cliente Fabiola: 100$ - 10%')
    expect(r).toMatchObject({ type: 'TRANSACCION', colaborador: null, cliente: 'Fabiola', usdTotal: 100, comisionPct: 10 })
  })

  it('con nombre compuesto', () => {
    const r = parsearMensaje('#TRANSACCION Cliente María González: 250$ - 15%')
    expect(r).toMatchObject({ type: 'TRANSACCION', cliente: 'María González', usdTotal: 250, comisionPct: 15 })
  })

  it('con colaborador Patty', () => {
    const r = parsearMensaje('#TRANSACCION Colaborador Patty Cliente Juan Carlos: 500$ - 13%')
    expect(r).toMatchObject({ type: 'TRANSACCION', colaborador: 'Patty', cliente: 'Juan Carlos', usdTotal: 500, comisionPct: 13 })
  })

  it('con colaborador Anael', () => {
    const r = parsearMensaje('#TRANSACCION Colaborador Anael Cliente Empresa SA: 1000$ - 10%')
    expect(r).toMatchObject({ type: 'TRANSACCION', colaborador: 'Anael', usdTotal: 1000, comisionPct: 10 })
  })

  it('con colaborador nuevo y override %', () => {
    const r = parsearMensaje('#TRANSACCION Colaborador NuevoNombre (7%) Cliente Pedro: 300$ - 13%')
    expect(r).toMatchObject({ type: 'TRANSACCION', colaborador: 'NuevoNombre', overridePct: 7, usdTotal: 300, comisionPct: 13 })
  })

  it('con usd_neto y monto_gs opcionales', () => {
    const r = parsearMensaje('#TRANSACCION Cliente Juan: $1.500 - 13% = $1.305 = 9.526.500 Gs')
    expect(r).toMatchObject({ type: 'TRANSACCION', usdTotal: 1500, comisionPct: 13, usdNeto: 1305 })
  })

  it('error si vacío', () => {
    expect(parsearMensaje('').type).toBe('ERROR')
  })

  it('error si #TRANSACCION sin formato', () => {
    expect(parsearMensaje('#TRANSACCION hola').type).toBe('ERROR')
  })

  it('error si #TASA sin número', () => {
    expect(parsearMensaje('#TASA abc').type).toBe('ERROR')
  })
})
