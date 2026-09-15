"use client"

import { toast } from "sonner"
import type { JobDetail } from "@/components/admin/queue/job-types"
import { QC, QC_TONES } from "@/components/admin/queue/tokens"
import { buildJobTimeline } from "@/components/admin/queue/timeline"
import { fmtDate, fmtRunTime } from "@/components/admin/queue/format"

export function JobDetailBody({ job }: { job: JobDetail }) {
  const timeline = buildJobTimeline(job)

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied")
    } catch {
      toast.error("Couldn't copy — clipboard access was blocked")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div
        style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: QC.borderHairline,
          border: `1px solid ${QC.borderHairline}`, borderRadius: 11, overflow: "hidden", flexShrink: 0,
        }}
      >
        <MetaCell label="Created" value={fmtDate(job.createdAt)} />
        <MetaCell label="Finished" value={fmtDate(job.completedAt)} />
        <MetaCell label="Run time" value={fmtRunTime(job.createdAt, job.completedAt)} />
        <MetaCell label="Locked by" value={job.lockedBy ?? "—"} mono />
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.005em", marginBottom: 12 }}>Lifecycle</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {timeline.map((step, i) => {
            const tone = QC_TONES[step.tone]
            return (
              <div key={i} style={{ display: "flex", gap: 13 }}>
                <div style={{ width: 18, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 99, background: tone.ink, border: "2px solid #fff", boxShadow: `0 0 0 2px ${tone.bg}`, marginTop: 3 }} />
                  {i < timeline.length - 1 && <div style={{ flex: 1, width: 1.5, background: QC.borderHairline, margin: "3px 0" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: QC.ink }}>{step.label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: QC.inkFaint }}>
                      {step.time ? new Date(step.time).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: QC.inkMuted, marginTop: 3, lineHeight: 1.55 }}>{step.detail}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {job.lastError && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Last error</div>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => copyText(job.lastError!)} style={linkButtonStyle}>Copy</button>
          </div>
          <div style={{ background: QC.traceBg, border: `1px solid ${QC.traceBorder}`, borderRadius: 11, padding: "13px 15px", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.75, color: QC.traceInk, whiteSpace: "pre-wrap", overflowX: "auto" }}>
            {job.lastError}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Payload</div>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => copyText(JSON.stringify(job.payload, null, 2))} style={linkButtonStyle}>Copy JSON</button>
        </div>
        <div style={{ background: QC.ink, borderRadius: 11, padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.8, color: QC.borderStrong, whiteSpace: "pre", overflowX: "auto" }}>
          {JSON.stringify(job.payload, null, 2)}
        </div>
      </div>
    </div>
  )
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: QC.panel, padding: "12px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase", color: QC.inkFaint }}>{label}</div>
      <div style={{ fontSize: mono ? 12 : 13, fontWeight: mono ? 500 : 600, marginTop: mono ? 5 : 4, fontVariantNumeric: "tabular-nums", fontFamily: mono ? "var(--font-mono)" : undefined }}>
        {value}
      </div>
    </div>
  )
}

const linkButtonStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: QC.gold, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
}
