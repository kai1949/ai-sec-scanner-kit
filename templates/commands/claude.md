---
description: Run ai-sec-scanner-kit full workflow
---

Run the security scanning workflow using the installed ai-sec-scanner-kit assets.

1. Ensure project root is known.
2. Use the orchestrator prompt file under `.claude/agents/ai-sec-orchestrator.md`.
3. Execute phases in order: architecture -> dataflow + security auditor -> verification -> reporter.
4. Write outputs to `scan-results/`.

If tool execution is available, use:

```bash
node .claude/ai-sec-scanner-kit/tools/vuln-db.ts --help
```
