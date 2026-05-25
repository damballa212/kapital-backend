import {
  findAllCollaborators,
  findCollaboratorByName,
  createCollaborator as dbCreate,
  updateCollaboratorById,
  deleteCollaboratorById,
} from '../repositories/collaborator.repository.js'
import { resolverColaborador } from './transaction.service.js'
import type { Collaborator } from '../domain/collaborator.js'

export async function listarColaboradores(): Promise<Collaborator[]> {
  return findAllCollaborators()
}

export async function crearColaborador(
  name: string,
  basePct: number | null,
  status: string = 'active'
): Promise<Collaborator> {
  return dbCreate(name, basePct, status)
}

export async function actualizarColaborador(
  id: number,
  fields: { name?: string; basePct?: number | null; status?: string }
): Promise<Collaborator> {
  const updated = await updateCollaboratorById(id, fields)
  if (!updated) throw new Error(`Colaborador ${id} no encontrado`)
  return updated
}

export async function eliminarColaborador(id: number): Promise<void> {
  const deleted = await deleteCollaboratorById(id)
  if (!deleted) throw new Error(`Colaborador ${id} no encontrado`)
}

/**
 * Resuelve el colaborador consultando primero la DB.
 * Si no está en DB, cae al resolver hardcodeado (backward compat).
 * El overridePct del mensaje siempre tiene prioridad sobre el valor en DB.
 */
export async function resolverColaboradorDb(
  nombre: string | null,
  comisionPct: number,
  overridePct: number | null
): Promise<{ colaborador: string; pct: number }> {
  if (!nombre) return { colaborador: 'Gabriel Zambrano', pct: 0 }

  const row = await findCollaboratorByName(nombre)
  if (row) {
    const pct = overridePct ?? row.basePctUsdTotal
    // Si el pct sigue siendo null (no registrado en DB), cae al resolver hardcodeado
    if (pct === null) {
      return resolverColaborador(nombre, comisionPct, overridePct)
    }
    return { colaborador: row.name, pct }
  }

  // No encontrado en DB → lógica hardcodeada (maneja variantes de nombre y colaboradores nuevos)
  return resolverColaborador(nombre, comisionPct, overridePct)
}
