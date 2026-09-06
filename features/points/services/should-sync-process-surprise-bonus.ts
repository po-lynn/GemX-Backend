/**
 * Whether Top-up should drain surprise_bonus_batch jobs in the same HTTP request.
 *
 * - SURPRISE_BONUS_SYNC_PROCESS=true  → always inline
 * - SURPRISE_BONUS_SYNC_PROCESS=false → never inline (after() + Vercel/Edge cron only)
 * - unset → **always inline** (including production)
 *
 * Inline is the default because Vercel `after()` and minutely crons are easy to miss
 * (Hobby plan, missing CRON_SECRET), which left campaigns stuck at status=processing
 * with 0 users credited. Opt out with =false only when a worker/cron is confirmed running.
 */
export function shouldSyncProcessSurpriseBonus(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.SURPRISE_BONUS_SYNC_PROCESS?.trim().toLowerCase()
  if (flag === "true") return true
  if (flag === "false") return false
  return true
}
