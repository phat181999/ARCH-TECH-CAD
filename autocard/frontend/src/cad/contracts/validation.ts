export type ValidationStage =
  | 'schema'
  | 'structural'
  | 'domain'
  | 'conflict'
  | 'derived-consistency'

export type ValidationError = {
  stage: ValidationStage
  code: string
  message: string
  nodeIds?: string[]
  field?: string
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] }

export type ImportDiagnostic = {
  severity: 'info' | 'warning' | 'error'
  entityType: string
  entityHandle?: string
  message: string
}

export type ExportDiagnostic = {
  severity: 'info' | 'warning' | 'error'
  nodeId?: string
  message: string
}
