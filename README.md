# AI Security Scanner Kit

多平台可安装的源码安全扫描能力包（C/C++ + Python）。

支持运行时：

- OpenCode
- Claude Code
- Codex
- Cursor
- Trae

核心能力保持一致：架构侦察、数据流扫描、安全审计、验证降误报、报告生成。

## 一条命令安装

```bash
npx ai-sec-scanner-kit@latest --all --local --target /path/to/project
```

无参数交互向导（TTY 环境）：

```bash
npx ai-sec-scanner-kit@latest
```

中国网络环境推荐：

```bash
npx ai-sec-scanner-kit@latest --all --local --target /path/to/project --cn
```

## 安装器能力

- 运行时选择：`--opencode --claude --codex --cursor --trae --all`
- 作用域选择：`--local`（项目）/ `--global`（用户）
- 卸载：`--uninstall`
- 校验：`--verify`
- 试运行：`--dry-run`
- 中国网络优化：`--cn`
- 自定义 registry：`--registry <url>`
- 无参数交互向导：自动选择 runtime/scope/target/cn/verify

## 常用命令

```bash
# 仅安装 OpenCode（项目级）
npx ai-sec-scanner-kit@latest --opencode --local --target /path/to/project --verify

# 安装所有运行时（全局）
npx ai-sec-scanner-kit@latest --all --global --verify

# 查看将执行的动作但不落盘
npx ai-sec-scanner-kit@latest --all --local --dry-run

# 卸载
npx ai-sec-scanner-kit@latest --all --local --target /path/to/project --uninstall --verify
```

## OpenCode 快速使用

```bash
npx ai-sec-scanner-kit@latest --opencode --local --target /path/to/project --verify
cd /path/to/project
opencode
```

在 OpenCode 会话中输入：

```text
@orchestrator 请扫描这个项目的安全漏洞，项目根目录是 /path/to/project
```

输出目录：

- `scan-results/threat_analysis_report.md`
- `scan-results/report_confirmed.md`
- `scan-results/report_unconfirmed.md`
- `scan-results/.context/scan.db`

## 仓库结构

```text
.
├── .opencode/                       # OpenCode 原生能力包（agents/skills/tools）
├── bin/install.js                   # 多平台安装器入口
├── lib/                             # 安装器核心逻辑
├── templates/commands/              # 非 OpenCode 运行时命令模板
├── docs/
│   ├── discovery-contract.md
│   └── china-deployment.md
├── test/                            # 自动化测试
├── scripts/install-opencode-security-kit.sh
├── README_multi-agent1.md
└── scan-results/
    ├── report.md
    └── threat_analysis_report.md
```

## 兼容层设计

- OpenCode：直接写入 `.opencode` 原生目录，开箱即用。
- Claude/Codex/Cursor/Trae：安装 `agents/skills/commands(or rules)` 适配层和 `ai-sec-scanner-kit` bundle。
- 每个 runtime root 写入 `.ai-sec-scanner-kit.manifest.json`，用于可回滚卸载。

## 中国区使用建议

详见：[china-deployment.md](./docs/china-deployment.md)

重点：

- 使用 `--cn` 启用镜像优先策略
- 受限网络可用本地源码安装：`node bin/install.js ...`
- 建议双仓发布（GitHub + Gitee）

## 发布流水线

- CI: [.github/workflows/ci.yml](/home/kai/code/opencode-scope_exclusion/ai-sec-scanner-kit/.github/workflows/ci.yml)
- Release: [.github/workflows/release.yml](/home/kai/code/opencode-scope_exclusion/ai-sec-scanner-kit/.github/workflows/release.yml)
- 说明文档: [release-pipeline.md](/home/kai/code/opencode-scope_exclusion/ai-sec-scanner-kit/docs/release-pipeline.md)

## 旧脚本兼容

保留旧入口：

```bash
bash scripts/install-opencode-security-kit.sh /path/to/project
```

该脚本现已委托给新安装器并自动 `--verify`。

## 开发与测试

```bash
npm test
```

## 授权

Apache-2.0
