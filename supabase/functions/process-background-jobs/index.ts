// Surprise Bonus background job processor
// Invoke via Supabase Cron every minute. One invocation = one batch (max 100 users).
// After new grants, POSTs to Next.js /api/cron/surprise-bonus-push for FCM (APP_URL + CRON_SECRET).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const BATCH_SIZE = 100
const JOB_TYPE = "surprise_bonus_batch"

type JobRow = {
  id: string
  type: string
  payload: { campaignId?: string; lastUserId?: string | null }
  status: string
  attempts: number
  max_attempts: number
}

type GrantResult = { granted?: boolean; reason?: string; points?: number }

Deno.serve(async (req) => {
  try {
    // Optional shared secret for cron → edge
    const cronSecret = Deno.env.get("CRON_SECRET")
    if (cronSecret) {
      const auth = req.headers.get("Authorization") ?? ""
      if (auth !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const lockedBy = `edge-${crypto.randomUUID().slice(0, 8)}`

    const { data: claimedRows, error: claimError } = await supabase.rpc(
      "claim_background_job",
      { p_type: JOB_TYPE, p_locked_by: lockedBy },
    )

    if (claimError) {
      console.error("[process-background-jobs] claim failed:", claimError)
      return json({ error: claimError.message }, 500)
    }

    const job = (Array.isArray(claimedRows) ? claimedRows[0] : claimedRows) as
      | JobRow
      | undefined

    if (!job?.id) {
      return json({ ok: true, claimed: false })
    }

    const campaignId = job.payload?.campaignId
    if (!campaignId) {
      await failOrRetryJob(supabase, job, "Missing campaignId in payload")
      return json({ ok: false, error: "Missing campaignId" }, 400)
    }

    try {
      const lastUserId = job.payload?.lastUserId ?? null

      let query = supabase
        .from("user")
        .select("id")
        .eq("banned", false)
        .eq("archived", false)
        .order("id", { ascending: true })
        .limit(BATCH_SIZE)

      if (lastUserId) {
        query = query.gt("id", lastUserId)
      }

      const { data: users, error: usersError } = await query
      if (usersError) throw new Error(usersError.message)

      const batch = users ?? []
      let successDelta = 0
      let failedDelta = 0
      const newlyGrantedUserIds: string[] = []

      for (const u of batch) {
        const { data: grantData, error: grantError } = await supabase.rpc(
          "grant_surprise_bonus_user",
          { p_campaign_id: campaignId, p_user_id: u.id },
        )

        if (grantError) {
          console.error("[process-background-jobs] grant error:", u.id, grantError)
          failedDelta++
          continue
        }

        const result = grantData as GrantResult
        if (result?.granted === true) {
          successDelta++
          newlyGrantedUserIds.push(u.id)
        } else if (result?.reason === "already_granted") {
          successDelta++
        } else if (
          result?.reason === "user_not_found" ||
          result?.reason === "campaign_not_found"
        ) {
          failedDelta++
        } else {
          successDelta++
        }
      }

      const { data: campaign, error: campErr } = await supabase
        .from("surprise_bonus_campaign")
        .select(
          "name, points_per_user, processed_users, success_count, failed_count, total_users",
        )
        .eq("id", campaignId)
        .single()

      if (campErr) throw new Error(campErr.message)

      const processedUsers = (campaign?.processed_users ?? 0) + batch.length
      const successCount = (campaign?.success_count ?? 0) + successDelta
      const failedCount = (campaign?.failed_count ?? 0) + failedDelta
      const hasMore = batch.length === BATCH_SIZE

      const campaignUpdate: Record<string, unknown> = {
        processed_users: processedUsers,
        success_count: successCount,
        failed_count: failedCount,
        status: hasMore ? "processing" : "completed",
        updated_at: new Date().toISOString(),
      }
      if (!hasMore) {
        campaignUpdate.completed_at = new Date().toISOString()
      }

      const { error: updCampErr } = await supabase
        .from("surprise_bonus_campaign")
        .update(campaignUpdate)
        .eq("id", campaignId)
      if (updCampErr) throw new Error(updCampErr.message)

      if (hasMore) {
        const nextLastId = batch[batch.length - 1]!.id
        const { error: nextJobErr } = await supabase.from("background_jobs").insert({
          id: crypto.randomUUID(),
          type: JOB_TYPE,
          payload: { campaignId, lastUserId: nextLastId },
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          available_at: new Date().toISOString(),
        })
        if (nextJobErr) throw new Error(nextJobErr.message)
      }

      const { error: completeErr } = await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
        })
        .eq("id", job.id)
      if (completeErr) throw new Error(completeErr.message)

      const pushResult = await notifyGrantedUsersViaApp({
        userIds: newlyGrantedUserIds,
        campaignId,
        campaignName: campaign?.name ?? "Surprise Bonus",
        pointsPerUser: campaign?.points_per_user ?? 0,
        cronSecret,
      })

      return json({
        ok: true,
        claimed: true,
        jobId: job.id,
        campaignId,
        batchSize: batch.length,
        successDelta,
        failedDelta,
        hasMore,
        campaignStatus: hasMore ? "processing" : "completed",
        push: pushResult,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error("[process-background-jobs] batch failed:", message)
      await failOrRetryJob(supabase, job, message)
      return json({ ok: false, error: message }, 500)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return json({ error: message }, 500)
  }
})

/** Call Next.js cron route so FCM uses the same Firebase Admin setup as the app. */
async function notifyGrantedUsersViaApp(input: {
  userIds: string[]
  campaignId: string
  campaignName: string
  pointsPerUser: number
  cronSecret: string | undefined
}): Promise<{ attempted: boolean; ok?: boolean; error?: string }> {
  if (input.userIds.length === 0) return { attempted: false }

  const appUrl = (
    Deno.env.get("APP_URL") ??
    Deno.env.get("NEXT_PUBLIC_SERVER_URL") ??
    ""
  ).replace(/\/$/, "")

  if (!appUrl) {
    console.warn("[process-background-jobs] skip FCM: set APP_URL or NEXT_PUBLIC_SERVER_URL")
    return { attempted: false, error: "APP_URL not set" }
  }
  if (!input.cronSecret) {
    console.warn("[process-background-jobs] skip FCM: CRON_SECRET not set")
    return { attempted: false, error: "CRON_SECRET not set" }
  }

  try {
    const res = await fetch(`${appUrl}/api/cron/surprise-bonus-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.cronSecret}`,
      },
      body: JSON.stringify({
        userIds: input.userIds,
        campaignId: input.campaignId,
        campaignName: input.campaignName,
        pointsPerUser: input.pointsPerUser,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error("[process-background-jobs] FCM proxy failed:", res.status, text)
      return { attempted: true, ok: false, error: text }
    }
    return { attempted: true, ok: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[process-background-jobs] FCM proxy error:", message)
    return { attempted: true, ok: false, error: message }
  }
}

async function failOrRetryJob(
  supabase: ReturnType<typeof createClient>,
  job: JobRow,
  lastError: string,
) {
  const attempts = job.attempts ?? 1
  const maxAttempts = job.max_attempts ?? 5
  if (attempts >= maxAttempts) {
    await supabase
      .from("background_jobs")
      .update({
        status: "failed",
        last_error: lastError,
        completed_at: new Date().toISOString(),
        locked_at: null,
        locked_by: null,
      })
      .eq("id", job.id)
    return
  }

  const delayMinutes = Math.min(attempts * 2, 30)
  const availableAt = new Date(Date.now() + delayMinutes * 60_000).toISOString()
  await supabase
    .from("background_jobs")
    .update({
      status: "pending",
      last_error: lastError,
      available_at: availableAt,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", job.id)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
