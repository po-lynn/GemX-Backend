import { describe, expect, it, vi } from "vitest"
import { getQueueJobDefinition, listRegisteredJobTypes, registerQueueJob } from "@/lib/queue/registry"

describe("queue registry", () => {
  it("registers and retrieves a job definition by type", () => {
    const handler = vi.fn()
    registerQueueJob({ type: "test_type_a", label: "Test A", handler })

    expect(getQueueJobDefinition("test_type_a")).toEqual({ type: "test_type_a", label: "Test A", handler })
  })

  it("returns undefined for an unregistered type", () => {
    expect(getQueueJobDefinition("nonexistent_type")).toBeUndefined()
  })

  it("lists all registered types with their labels", () => {
    registerQueueJob({ type: "test_type_b", label: "Test B", handler: vi.fn() })
    registerQueueJob({ type: "test_type_c", label: "Test C", handler: vi.fn() })

    const types = listRegisteredJobTypes()
    expect(types).toEqual(
      expect.arrayContaining([
        { type: "test_type_b", label: "Test B" },
        { type: "test_type_c", label: "Test C" },
      ]),
    )
  })
})
