import type { CadDocument } from '../../contracts/document'
import type { CadCommand } from '../../contracts/commands'
import type { ValidationResult, ValidationError } from '../../contracts/validation'
import { cadBus } from '../events/bus'
import { validateCreateNode, applyCreateNode } from './reducers/create-node'
import { validateUpdateNode, applyUpdateNode } from './reducers/update-node'
import { validateDeleteNode, applyDeleteNode } from './reducers/delete-node'
import { validateMoveNode, applyMoveNode } from './reducers/move-node'

type ExecuteResult =
  | { ok: true; newDoc: CadDocument; dirtyNodeIds: string[] }
  | { ok: false; errors: ValidationError[] }

function getDirtyNodeIds(cmd: CadCommand): string[] {
  switch (cmd.type) {
    case 'create-node':   return [cmd.node.id]
    case 'update-node':   return [cmd.nodeId]
    case 'delete-node':   return [cmd.nodeId]
    case 'move-node':     return [cmd.nodeId]
    case 'insert-block':  return []
    case 'group-nodes':   return cmd.nodeIds
    case 'ungroup-nodes': return [cmd.groupId]
    default:              return []
  }
}

function validate(cmd: CadCommand, doc: CadDocument): ValidationResult {
  switch (cmd.type) {
    case 'create-node':   return validateCreateNode(cmd, doc)
    case 'update-node':   return validateUpdateNode(cmd, doc)
    case 'delete-node':   return validateDeleteNode(cmd, doc)
    case 'move-node':     return validateMoveNode(cmd, doc)
    default:              return { ok: true }
  }
}

function apply(cmd: CadCommand, doc: CadDocument): CadDocument {
  switch (cmd.type) {
    case 'create-node':   return applyCreateNode(cmd, doc)
    case 'update-node':   return applyUpdateNode(cmd, doc)
    case 'delete-node':   return applyDeleteNode(cmd, doc)
    case 'move-node':     return applyMoveNode(cmd, doc)
    default:              return doc
  }
}

export class CommandPipeline {
  execute(cmd: CadCommand, doc: CadDocument): ExecuteResult {
    const validationResult = validate(cmd, doc)
    if (!validationResult.ok) {
      cadBus.emit('cad:command:rejected', { command: cmd, errors: validationResult.errors })
      return { ok: false, errors: validationResult.errors }
    }

    const newDoc = apply(cmd, doc)
    const dirtyNodeIds = getDirtyNodeIds(cmd)

    cadBus.emit('cad:command:committed', { command: cmd, dirtyNodeIds, newDoc })
    cadBus.emit('cad:derived:invalidated', {
      caches: ['wallPolygons', 'wallJoins', 'roomGraphs', 'snapIndex', 'spatialIndex', 'nodeBounds'],
      dirtyNodeIds,
    })

    return { ok: true, newDoc, dirtyNodeIds }
  }

  executeBatch(commands: CadCommand[], doc: CadDocument): ExecuteResult {
    let current = doc
    const allDirty: string[] = []

    for (const cmd of commands) {
      const result = this.execute(cmd, current)
      if (!result.ok) return result
      current = result.newDoc
      allDirty.push(...result.dirtyNodeIds)
    }

    return { ok: true, newDoc: current, dirtyNodeIds: [...new Set(allDirty)] }
  }
}

export const commandPipeline = new CommandPipeline()
