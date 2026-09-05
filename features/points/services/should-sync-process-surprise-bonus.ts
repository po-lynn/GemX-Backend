/**
 * Whether Top-up should drain surprise_bonus_batch jobs in-process
 * (local/dev) instead of after()+Vercel cron / Edge Function.
 *
 * - SURPRISE_BONUS_SYNC_PROCESS=true  → always inline
 * - SURPRISE_BONUS_SYNC_PROCESS=false → never inline (after + cron)
 * - unset → inline when NODE_ENV !== "production"
 */
export function shouldSyncProcessSurpriseBonus(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.SURPRISE_BONUS_SYNC_PROCESS?.trim().toLowerCase()
  if (flag === "true") return true
  if (flag === "false") return false
  return env.NODE_ENV !== "production"
}
