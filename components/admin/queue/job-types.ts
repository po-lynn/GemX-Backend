export type JobDetail = {
  id: string
  type: string
  label: string
  status: string
  isStale: boolean
  attempts: number
  maxAttempts: number
  availableAt: string
  lockedAt: string | null
  lockedBy: string | null
  lastError: string | null
  result: Record<string, unknown> | null
  payload: Record<string, unknown>
  createdAt: string
  completedAt: string | null
  description: string | null
}
