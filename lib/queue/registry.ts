import type { QueueJobDefinition } from "@/lib/queue/types"

const registry = new Map<string, QueueJobDefinition>()

export function registerQueueJob(def: QueueJobDefinition): void {
  registry.set(def.type, def)
}

export function getQueueJobDefinition(type: string): QueueJobDefinition | undefined {
  return registry.get(type)
}

export function listRegisteredJobTypes(): { type: string; label: string }[] {
  return [...registry.values()].map((d) => ({ type: d.type, label: d.label }))
}
