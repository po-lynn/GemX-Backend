/**
 * Deletes ALL files from every Supabase Storage bucket in this project.
 * Run with: node scripts/clear-storage-buckets.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load .env manually (no dotenv dep needed)
const envPath = resolve(process.cwd(), ".env")
const envText = readFileSync(envPath, "utf-8")
const env = {}
for (const line of envText.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const idx = trimmed.indexOf("=")
  if (idx === -1) continue
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const BUCKETS = [
  "product-images",
  "product-videos",
  "product-certificates",
  "user-images",
  "chat-media",
  "category-images",
]

async function listAllFiles(bucket, prefix = "") {
  const files = []
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } })

    if (error) {
      // Bucket may not exist yet — skip silently
      if (error.message?.includes("Not Found") || error.message?.includes("does not exist")) {
        return []
      }
      throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    }

    if (!data || data.length === 0) break

    for (const item of data) {
      if (item.id === null) {
        // Folder — recurse
        const sub = prefix ? `${prefix}/${item.name}` : item.name
        const children = await listAllFiles(bucket, sub)
        files.push(...children)
      } else {
        files.push(prefix ? `${prefix}/${item.name}` : item.name)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return files
}

async function deleteBatch(bucket, paths) {
  const BATCH = 100
  let deleted = 0
  for (let i = 0; i < paths.length; i += BATCH) {
    const slice = paths.slice(i, i + BATCH)
    const { error } = await supabase.storage.from(bucket).remove(slice)
    if (error) throw new Error(`delete from ${bucket}: ${error.message}`)
    deleted += slice.length
  }
  return deleted
}

async function main() {
  let totalDeleted = 0

  for (const bucket of BUCKETS) {
    process.stdout.write(`  ${bucket}: listing...`)
    let files
    try {
      files = await listAllFiles(bucket)
    } catch (err) {
      console.log(` SKIP (${err.message})`)
      continue
    }

    if (files.length === 0) {
      console.log(" empty, nothing to delete")
      continue
    }

    process.stdout.write(` ${files.length} files found, deleting...`)
    const deleted = await deleteBatch(bucket, files)
    console.log(` done (${deleted} deleted)`)
    totalDeleted += deleted
  }

  console.log(`\nTotal deleted: ${totalDeleted} files`)
}

main().catch((err) => {
  console.error("Error:", err.message)
  process.exit(1)
})
