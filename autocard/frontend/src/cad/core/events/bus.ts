type Listener<T> = (payload: T) => void

export class TypedEventBus<TMap extends Record<string, unknown>> {
  private listeners = new Map<string, Set<Listener<unknown>>>()

  on<K extends keyof TMap & string>(event: K, listener: Listener<TMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>)
    return () => this.off(event, listener)
  }

  off<K extends keyof TMap & string>(event: K, listener: Listener<TMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>)
  }

  emit<K extends keyof TMap & string>(event: K, payload: TMap[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(payload))
  }

  clear(): void {
    this.listeners.clear()
  }
}

import type { CadEventMap } from '../../contracts/events'

export const cadBus = new TypedEventBus<CadEventMap>()
