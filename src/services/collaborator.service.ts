import { findAllCollaborators } from '../repositories/collaborator.repository.js'
import type { Collaborator } from '../domain/collaborator.js'

export async function listarColaboradores(): Promise<Collaborator[]> {
  return findAllCollaborators()
}
