/// <reference path="../env.d.ts" />
import { tool } from "@opencode-ai/plugin"
import DESCRIPTION from "./report-generator.txt"
import { Database } from "bun:sqlite"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { dirname } from "node:path"

interface Vuln {
  id: string
  type: string | null
  cwe: string | null
  severity: string | null
  verified_severity: string | null
  original_severity: string | null
  description: string | null
  file: string | null
  line_start: number | null
  line_end: number | null
  function_name: string | null
  code_snippet: string | null
  data_flow: string | null
  confidence: number | null
  status: string | null
  source_agents: string | null
  source_module: string | null
  scoring_details: string | null
  veto_applied: number
  verification_reason: string | null
  cross_module: number
  modules_involved: string | null
  control_flow: string | null
  mitigations_found: string | null
}

interface ProjectModel {
  project_name?: string
  scan_time?: string
  project_profile?: {
    project_type?: string
    deployment_model?: string
    trust_boundaries?: Array<{
      boundary: string
      trusted_side: string
      untrusted_side: string
      risk: string
    }>
  }
  entry_points?: Array<{
    file: string
    line?: number
    function: string
    type: string
    trust_level?: string
    justification?: string
    description?: string
  }>
  attack_surfaces?: string[]
}

const SEVERITY_LEVELS = ["Critical", "High", "Medium", "Low"]
const CVSS_METRIC_ORDER = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]
const CVSS_METRIC_NAMES: Record<string, string> = {
  AV: "Attack Vector",
  AC: "Attack Complexity",
  PR: "Privileges Required",
  UI: "User Interaction",
  S: "Scope",
  C: "Confidentiality",
  I: "Integrity",
  A: "Availability",
}
const CVSS_METRIC_VALUE_LABELS: Record<string, Record<string, string>> = {
  AV: { N: "Network", A: "Adjacent", L: "Local", P: "Physical" },
  AC: { L: "Low", H: "High" },
  PR: { N: "None", L: "Low", H: "High" },
  UI: { N: "None", R: "Required" },
  S: { U: "Unchanged", C: "Changed" },
  C: { H: "High", L: "Low", N: "None" },
  I: { H: "High", L: "Low", N: "None" },
  A: { H: "High", L: "Low", N: "None" },
}

interface CvssDetails {
  version?: string
  vector?: string
  score?: number | string
  severity?: string
  metrics?: Record<string, string>
  metric_justification?: Record<string, string>
  explanations?: Record<string, string>
  notes?: string[] | string
}

function severitySortKey(s: string | null): number {
  const idx = SEVERITY_LEVELS.indexOf(s ?? "")
  return idx >= 0 ? idx : 99
}

function escapeMarkdown(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ")
}

function parseJsonField(val: string | null): unknown {
  if (!val) return null
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val)
}

function normalizeStringRecord(val: unknown): Record<string, string> | undefined {
  if (!isRecord(val)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(val)) {
    if (v == null) continue
    out[k] = String(v)
  }
  return out
}

function getCvssDetails(scoringDetails: unknown): CvssDetails | null {
  if (!isRecord(scoringDetails)) return null
  const raw = scoringDetails.cvss_v3_1 ?? scoringDetails.cvss_v31 ?? scoringDetails.cvss
  if (!raw) return null
  const parsed = typeof raw === "string" ? parseJsonField(raw) : raw
  if (!isRecord(parsed)) return null
  return {
    version: parsed.version == null ? undefined : String(parsed.version),
    vector: parsed.vector == null ? undefined : String(parsed.vector),
    score: typeof parsed.score === "number" || typeof parsed.score === "string" ? parsed.score : undefined,
    severity: parsed.severity == null ? undefined : String(parsed.severity),
    metrics: normalizeStringRecord(parsed.metrics),
    metric_justification: normalizeStringRecord(parsed.metric_justification),
    explanations: normalizeStringRecord(parsed.explanations),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : parsed.notes == null ? undefined : String(parsed.notes),
  }
}

function cvssRoundUp(input: number): number {
  return Math.ceil((input + 0.000001) * 10) / 10
}

function computeCvssBaseScore(metrics: Record<string, string> | undefined): number | null {
  if (!metrics) return null
  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[metrics.AV]
  const ac = { L: 0.77, H: 0.44 }[metrics.AC]
  const ui = { N: 0.85, R: 0.62 }[metrics.UI]
  const scope = metrics.S
  const pr =
    scope === "C"
      ? { N: 0.85, L: 0.68, H: 0.5 }[metrics.PR]
      : { N: 0.85, L: 0.62, H: 0.27 }[metrics.PR]
  const c = { H: 0.56, L: 0.22, N: 0 }[metrics.C]
  const i = { H: 0.56, L: 0.22, N: 0 }[metrics.I]
  const a = { H: 0.56, L: 0.22, N: 0 }[metrics.A]
  if ([av, ac, pr, ui, c, i, a].some((x) => typeof x !== "number")) return null

  const impact = 1 - (1 - c!) * (1 - i!) * (1 - a!)
  if (impact <= 0) return 0
  const impactSubScore =
    scope === "C" ? 7.52 * (impact - 0.029) - 3.25 * Math.pow(impact - 0.02, 15) : 6.42 * impact
  const exploitability = 8.22 * av! * ac! * pr! * ui!
  const raw = scope === "C" ? Math.min(1.08 * (impactSubScore + exploitability), 10) : Math.min(impactSubScore + exploitability, 10)
  return cvssRoundUp(raw)
}

function cvssSeverity(score: number | null): string {
  if (score == null) return "Unknown"
  if (score === 0) return "None"
  if (score < 4) return "Low"
  if (score < 7) return "Medium"
  if (score < 9) return "High"
  return "Critical"
}

function buildCvssVector(metrics: Record<string, string> | undefined): string | null {
  if (!metrics) return null
  const parts: string[] = []
  for (const key of CVSS_METRIC_ORDER) {
    const val = metrics[key]
    if (!val) return null
    parts.push(`${key}:${val}`)
  }
  return `CVSS:3.1/${parts.join("/")}`
}

function formatScalar(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}

function formatCvssSection(v: Vuln, includeCvssDetails: boolean): string[] {
  if (!includeCvssDetails) return []
  const lines: string[] = []
  const scoringDetails = parseJsonField(v.scoring_details)
  const cvss = getCvssDetails(scoringDetails)

  if (!cvss) {
    lines.push("**CVSS v3.1**: 未记录（旧扫描数据或验证阶段未写入 CVSS 指标）")
    lines.push("")
    return lines
  }

  const computedScore = computeCvssBaseScore(cvss.metrics)
  const numericScore = typeof cvss.score === "number" ? cvss.score : cvss.score != null ? Number(cvss.score) : computedScore
  const scoreNumber = Number.isFinite(numericScore) ? Number(numericScore) : null
  const scoreLabel = scoreNumber == null ? "?" : scoreNumber.toFixed(1)
  const severity = cvss.severity ?? cvssSeverity(scoreNumber ?? computedScore)
  const vector = cvss.vector ?? buildCvssVector(cvss.metrics) ?? "未记录"

  lines.push(`**CVSS v3.1**: ${scoreLabel} (${severity}) | **Vector**: \`${vector}\``)
  lines.push("")

  if (cvss.metrics) {
    const justifications = cvss.metric_justification ?? cvss.explanations ?? {}
    lines.push("| 指标 | 取值 | 判断依据 |")
    lines.push("|------|------|----------|")
    for (const key of CVSS_METRIC_ORDER) {
      const value = cvss.metrics[key]
      if (!value) continue
      const metricName = CVSS_METRIC_NAMES[key] ?? key
      const valueLabel = CVSS_METRIC_VALUE_LABELS[key]?.[value] ?? value
      const why = escapeMarkdown(justifications[key] ?? "-")
      lines.push(`| ${key} (${metricName}) | ${value} (${valueLabel}) | ${why} |`)
    }
    lines.push("")
  }

  if (cvss.notes) {
    const notes = Array.isArray(cvss.notes) ? cvss.notes : [cvss.notes]
    for (const note of notes) lines.push(`- CVSS 备注: ${note}`)
    lines.push("")
  }

  return lines
}

function formatDataFlow(raw: string | null): string {
  if (!raw) return ""
  return raw
}

function formatSourceAgents(raw: string | null): string {
  const parsed = parseJsonField(raw)
  if (Array.isArray(parsed)) return parsed.join(", ")
  return raw ?? "unknown"
}

function buildVulnDetailSection(
  vulns: Vuln[],
  startSection: number,
  includeCvssDetails: boolean,
): { lines: string[]; nextSection: number } {
  const lines: string[] = []
  const grouped: Record<string, Vuln[]> = {}
  for (const v of vulns) {
    const sev = v.verified_severity ?? v.severity ?? "Unknown"
    if (!grouped[sev]) grouped[sev] = []
    grouped[sev].push(v)
  }

  let sectionNum = startSection
  for (const sev of SEVERITY_LEVELS) {
    const group = grouped[sev]
    if (!group || group.length === 0) continue

    lines.push(`## ${sectionNum}. ${sev} 漏洞 (${group.length})`)
    lines.push("")

    for (const v of group) {
      lines.push(`### [${v.id}] ${v.type ?? "unknown"} - ${v.function_name ?? "unknown"}`)
      lines.push("")

      const sevLabel =
        v.original_severity && v.original_severity !== v.verified_severity
          ? `${v.verified_severity}（原评估: ${v.original_severity} → 验证后: ${v.verified_severity}）`
          : (v.verified_severity ?? v.severity ?? "?")
      const agents = formatSourceAgents(v.source_agents)
      lines.push(`**严重性**: ${sevLabel} | **CWE**: ${v.cwe ?? "N/A"} | **置信度**: ${v.confidence ?? "?"}/100 | **状态**: ${v.status} | **来源**: ${agents}`)
      lines.push("")
      lines.push(...formatCvssSection(v, includeCvssDetails))

      const lineRange =
        v.line_start && v.line_end && v.line_end !== v.line_start ? `${v.line_start}-${v.line_end}` : String(v.line_start ?? "?")
      lines.push(`**位置**: \`${v.file ?? "?"}:${lineRange}\` @ \`${v.function_name ?? "?"}\``)
      if (v.source_module) lines.push(`**模块**: ${v.source_module}`)
      if (v.cross_module && v.modules_involved) {
        const mods = parseJsonField(v.modules_involved)
        lines.push(`**跨模块**: ${Array.isArray(mods) ? mods.join(" → ") : v.modules_involved}`)
      }
      lines.push("")

      if (v.description) {
        lines.push(`**描述**: ${v.description}`)
        lines.push("")
      }

      if (v.code_snippet) {
        lines.push(`**漏洞代码** (\`${v.file ?? "?"}:${lineRange}\`)`)
        lines.push("")
        lines.push("```c")
        lines.push(v.code_snippet)
        lines.push("```")
        lines.push("")
      }

      const dataFlowStr = formatDataFlow(v.data_flow)
      if (dataFlowStr) {
        lines.push(`**达成路径**`)
        lines.push("")
        lines.push(dataFlowStr)
        lines.push("")
      }

      if (v.verification_reason) {
        lines.push(`**验证说明**: ${v.verification_reason}`)
        lines.push("")
      }

      if (v.scoring_details) {
        const sd = parseJsonField(v.scoring_details) as Record<string, unknown> | null
        if (sd) {
          const parts: string[] = []
          for (const [k, val] of Object.entries(sd)) {
            if (k === "notes") continue
            if (k === "cvss_v3_1" || k === "cvss_v31" || k === "cvss") continue
            parts.push(`${k}: ${formatScalar(val)}`)
          }
          if (parts.length > 0) {
            lines.push(`**评分明细**: ${parts.join(" | ")}`)
            lines.push("")
          }
        }
      }

      lines.push(`---`)
      lines.push("")
    }

    sectionNum++
  }
  return { lines, nextSection: sectionNum }
}

function buildDistributionSection(
  vulns: Vuln[],
  moduleSeverity: Array<{ source_module: string; sev: string; cnt: number }>,
  cweCounts: Array<{ cwe: string; cnt: number }>,
  sectionNum: number,
): string[] {
  const lines: string[] = []
  const effectiveTotal = vulns.length

  lines.push(`## ${sectionNum}. 模块漏洞分布`)
  lines.push("")

  const modules = [...new Set(moduleSeverity.map((r) => r.source_module))].sort()
  const moduleTable: Record<string, Record<string, number>> = {}
  for (const r of moduleSeverity) {
    if (!moduleTable[r.source_module]) moduleTable[r.source_module] = {}
    moduleTable[r.source_module][r.sev] = r.cnt
  }

  lines.push(`| 模块 | Critical | High | Medium | Low | 合计 |`)
  lines.push(`|------|----------|------|--------|-----|------|`)
  const colTotals: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  let grandTotal = 0
  for (const mod of modules) {
    const row = moduleTable[mod] ?? {}
    let rowTotal = 0
    const cells = SEVERITY_LEVELS.map((s) => {
      const c = row[s] ?? 0
      rowTotal += c
      colTotals[s] += c
      return String(c)
    })
    grandTotal += rowTotal
    lines.push(`| ${mod ?? "(unknown)"} | ${cells.join(" | ")} | ${rowTotal} |`)
  }
  lines.push(
    `| **合计** | ${SEVERITY_LEVELS.map((s) => `**${colTotals[s]}**`).join(" | ")} | **${grandTotal}** |`,
  )
  lines.push("")

  lines.push(`## ${sectionNum + 1}. CWE 分布`)
  lines.push("")
  lines.push(`| CWE | 数量 | 占比 |`)
  lines.push(`|-----|------|------|`)
  for (const row of cweCounts) {
    const pct = effectiveTotal > 0 ? ((row.cnt / effectiveTotal) * 100).toFixed(1) : "0"
    lines.push(`| ${row.cwe ?? "N/A"} | ${row.cnt} | ${pct}% |`)
  }
  lines.push("")

  return lines
}

function buildSingleReport(opts: {
  title: string
  subtitle: string
  projectName: string
  scanTime: string
  vulns: Vuln[]
  totalVerified: number
  falsePositives: number
  statusCounts: Array<{ status: string; cnt: number }>
  moduleSeverity: Array<{ source_module: string; sev: string; cnt: number }>
  cweCounts: Array<{ cwe: string; cnt: number }>
  projectModel: ProjectModel
  includeCvssDetails?: boolean
}): string {
  const { vulns, projectModel } = opts
  const md: string[] = []

  md.push(`# ${opts.title}`)
  md.push("")
  md.push(`**项目**: ${opts.projectName}`)
  md.push(`**扫描时间**: ${opts.scanTime}`)
  if (opts.subtitle) {
    md.push(`**报告范围**: ${opts.subtitle}`)
  }
  md.push("")
  md.push(`---`)
  md.push("")

  md.push(`## 1. 扫描摘要`)
  md.push("")
  md.push(`### 1.1 验证状态分布`)
  md.push("")
  md.push(`| 状态 | 数量 | 占比 |`)
  md.push(`|------|------|------|`)
  for (const row of opts.statusCounts) {
    const pct = opts.totalVerified > 0 ? ((row.cnt / opts.totalVerified) * 100).toFixed(1) : "0"
    md.push(`| ${row.status} | ${row.cnt} | ${pct}% |`)
  }
  md.push(`| **总计** | **${opts.totalVerified}** | 100% |`)
  md.push("")

  const severityCounts: Record<string, number> = {}
  for (const v of vulns) {
    const sev = v.verified_severity ?? v.severity ?? "Unknown"
    severityCounts[sev] = (severityCounts[sev] ?? 0) + 1
  }

  md.push(`### 1.2 严重性分布`)
  md.push("")
  md.push(`| 严重性 | 数量 | 占比 |`)
  md.push(`|--------|------|------|`)
  const effectiveTotal = vulns.length
  for (const sev of SEVERITY_LEVELS) {
    const cnt = severityCounts[sev] ?? 0
    if (cnt === 0) continue
    const pct = effectiveTotal > 0 ? ((cnt / effectiveTotal) * 100).toFixed(1) : "0"
    md.push(`| ${sev} | ${cnt} | ${pct}% |`)
  }
  md.push(`| **有效漏洞总计** | **${effectiveTotal}** | - |`)
  md.push(`| 误报 (FALSE_POSITIVE) | ${opts.falsePositives} | - |`)
  md.push("")

  md.push(`### 1.3 Top 10 关键漏洞`)
  md.push("")
  const top10 = vulns.slice(0, 10)
  for (let i = 0; i < top10.length; i++) {
    const v = top10[i]
    const sev = v.verified_severity ?? v.severity ?? "?"
    const loc = v.file ? `\`${v.file}:${v.line_start ?? "?"}\`` : "?"
    md.push(`${i + 1}. **[${v.id}]** ${v.type ?? "unknown"} (${sev}) - ${loc} @ \`${v.function_name ?? "?"}\` | 置信度: ${v.confidence}`)
  }
  md.push("")
  md.push(`---`)
  md.push("")

  md.push(`## 2. 攻击面分析`)
  md.push("")
  if (projectModel.entry_points && projectModel.entry_points.length > 0) {
    md.push(`| 入口点 | 类型 | 信任等级 | 可达性理由 | 说明 |`)
    md.push(`|--------|------|----------|-----------|------|`)
    for (const ep of projectModel.entry_points) {
      md.push(
        `| \`${ep.function}@${ep.file}\` | ${ep.type} | ${ep.trust_level ?? "-"} | ${escapeMarkdown(ep.justification ?? "-")} | ${escapeMarkdown(ep.description ?? "-")} |`,
      )
    }
  } else {
    md.push(`未找到入口点数据。`)
  }
  md.push("")
  if (projectModel.attack_surfaces && projectModel.attack_surfaces.length > 0) {
    md.push(`**其他攻击面**:`)
    for (const s of projectModel.attack_surfaces) {
      md.push(`- ${s}`)
    }
  }
  md.push("")
  md.push(`---`)
  md.push("")

  const { lines: detailLines, nextSection } = buildVulnDetailSection(vulns, 3, opts.includeCvssDetails ?? false)
  md.push(...detailLines)

  md.push(...buildDistributionSection(vulns, opts.moduleSeverity, opts.cweCounts, nextSection))

  return md.join("\n")
}

export default tool({
  description: DESCRIPTION,
  args: {
    db_path: tool.schema.string().describe("Absolute path to the SQLite database file"),
    project_model_path: tool.schema.string().describe("Absolute path to project_model.json"),
    output_path: tool.schema.string().describe("Absolute path for the output Markdown report (base name, will generate _confirmed and _unconfirmed variants)"),
    min_confidence: tool.schema.number().optional().describe("Minimum confidence threshold (default: 40)"),
    code_root: tool.schema.string().optional().describe("PROJECT_ROOT for relative path labels"),
  },
  async execute(args) {
    const minConf = args.min_confidence ?? 40
    const db = new Database(args.db_path)
    db.exec("PRAGMA journal_mode=WAL")

    try {
      let projectModel: ProjectModel = {}
      try {
        const raw = await readFile(args.project_model_path, "utf-8")
        projectModel = JSON.parse(raw)
      } catch {}

      const projectName = projectModel.project_name ?? "Unknown Project"
      const scanTime =
        projectModel.scan_time ??
        ((db.prepare("SELECT value FROM scan_metadata WHERE key = 'scan_time'").get() as { value: string } | null)?.value ??
          new Date().toISOString())

      const allVulns = db
        .prepare(
          `SELECT * FROM vulnerabilities
         WHERE phase = 'verified' AND dedup_kept = 1
           AND status != 'FALSE_POSITIVE' AND confidence >= ?
         ORDER BY
           CASE COALESCE(verified_severity, severity)
             WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
           confidence DESC`,
        )
        .all(minConf) as Vuln[]

      const confirmedVulns = allVulns.filter((v) => v.status === "CONFIRMED")
      const unconfirmedVulns = allVulns.filter((v) => v.status !== "CONFIRMED")

      const totalVerified = (
        db.prepare("SELECT COUNT(*) as cnt FROM vulnerabilities WHERE phase = 'verified' AND dedup_kept = 1").get() as { cnt: number }
      ).cnt
      const falsePositives = (
        db
          .prepare(
            "SELECT COUNT(*) as cnt FROM vulnerabilities WHERE phase = 'verified' AND dedup_kept = 1 AND status = 'FALSE_POSITIVE'",
          )
          .get() as { cnt: number }
      ).cnt

      const statusCounts = db
        .prepare(
          "SELECT status, COUNT(*) as cnt FROM vulnerabilities WHERE phase = 'verified' AND dedup_kept = 1 GROUP BY status ORDER BY cnt DESC",
        )
        .all() as Array<{ status: string; cnt: number }>

      function queryModuleSeverity(statusFilter: string): Array<{ source_module: string; sev: string; cnt: number }> {
        const op = statusFilter === "CONFIRMED" ? "=" : "!="
        return db
          .prepare(
            `SELECT source_module, COALESCE(verified_severity, severity) as sev, COUNT(*) as cnt
           FROM vulnerabilities
           WHERE phase = 'verified' AND dedup_kept = 1 AND status ${op} 'CONFIRMED'
             AND status != 'FALSE_POSITIVE' AND confidence >= ?
           GROUP BY source_module, sev`,
          )
          .all(minConf) as Array<{ source_module: string; sev: string; cnt: number }>
      }

      function queryCweCounts(statusFilter: string): Array<{ cwe: string; cnt: number }> {
        const op = statusFilter === "CONFIRMED" ? "=" : "!="
        return db
          .prepare(
            `SELECT cwe, COUNT(*) as cnt
           FROM vulnerabilities
           WHERE phase = 'verified' AND dedup_kept = 1 AND status ${op} 'CONFIRMED'
             AND status != 'FALSE_POSITIVE' AND confidence >= ?
           GROUP BY cwe ORDER BY cnt DESC`,
          )
          .all(minConf) as Array<{ cwe: string; cnt: number }>
      }

      const basePath = args.output_path.replace(/\.md$/i, "")
      const confirmedPath = `${basePath}_confirmed.md`
      const unconfirmedPath = `${basePath}_unconfirmed.md`

      const sharedOpts = { projectName, scanTime, totalVerified, falsePositives, statusCounts, projectModel }

      const confirmedReport = buildSingleReport({
        ...sharedOpts,
        title: "漏洞扫描报告 — 已确认漏洞",
        subtitle: "仅包含 CONFIRMED 状态的漏洞",
        vulns: confirmedVulns,
        moduleSeverity: queryModuleSeverity("CONFIRMED"),
        cweCounts: queryCweCounts("CONFIRMED"),
        includeCvssDetails: true,
      })

      const unconfirmedReport = buildSingleReport({
        ...sharedOpts,
        title: "漏洞扫描报告 — 待确认漏洞",
        subtitle: "包含 LIKELY / POSSIBLE 状态的漏洞",
        vulns: unconfirmedVulns,
        moduleSeverity: queryModuleSeverity("UNCONFIRMED"),
        cweCounts: queryCweCounts("UNCONFIRMED"),
      })

      await mkdir(dirname(confirmedPath), { recursive: true })
      await writeFile(confirmedPath, confirmedReport, "utf-8")
      await writeFile(unconfirmedPath, unconfirmedReport, "utf-8")

      const confirmedSev: Record<string, number> = {}
      for (const v of confirmedVulns) {
        const s = v.verified_severity ?? v.severity ?? "Unknown"
        confirmedSev[s] = (confirmedSev[s] ?? 0) + 1
      }

      return [
        `Two reports generated:`,
        `  1. ${confirmedPath} (CONFIRMED: ${confirmedVulns.length} vulns)`,
        `     Severity: ${SEVERITY_LEVELS.map((s) => `${s}=${confirmedSev[s] ?? 0}`).join(", ")}`,
        `  2. ${unconfirmedPath} (LIKELY/POSSIBLE: ${unconfirmedVulns.length} vulns)`,
      ].join("\n")
    } finally {
      db.close()
    }
  },
})
