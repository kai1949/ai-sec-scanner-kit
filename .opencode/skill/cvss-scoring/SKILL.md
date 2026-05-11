---
name: cvss-scoring
description: CVSS v3.1 Base score 评分方法。在验证 CONFIRMED 漏洞时使用此 Skill 生成 CVSS 向量、指标明细、分数和定性等级。
---

## Use this when

- 漏洞已通过验证并准备标记为 `CONFIRMED`
- 需要在 `scoring_details` 中写入 CVSS Base score 明细
- 需要为 `report_confirmed.md` 提供可追溯的 CVSS 向量和指标解释

## 版本说明

使用 **CVSS v3.1 Base Metrics**。不要写成 CVSS v3.2；FIRST 官方公开版本包含 v3.0/v3.1 和 v4.0，未发布 v3.2。

本 Skill 只要求 Base score。不要计算 Temporal 或 Environmental score，除非用户明确要求并提供环境参数。

## 输出位置

在 Verification Worker 写入数据库时，把 CVSS 明细放入漏洞记录的 `scoring_details.cvss_v3_1`：

```json
{
  "base": 30,
  "reachability": 30,
  "controllability": 25,
  "mitigations": 0,
  "context": 0,
  "cross_file": 0,
  "cvss_v3_1": {
    "version": "3.1",
    "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "score": 9.8,
    "severity": "Critical",
    "metrics": {
      "AV": "N",
      "AC": "L",
      "PR": "N",
      "UI": "N",
      "S": "U",
      "C": "H",
      "I": "H",
      "A": "H"
    },
    "metric_justification": {
      "AV": "漏洞可通过网络请求触达",
      "AC": "利用不依赖特殊竞态或复杂前置条件",
      "PR": "攻击者无需认证",
      "UI": "不需要用户交互",
      "S": "影响限定在同一安全权限域",
      "C": "可读取敏感数据",
      "I": "可篡改数据或执行非预期操作",
      "A": "可能导致服务崩溃或资源耗尽"
    }
  }
}
```

## Base Metrics

| 指标 | 取值 | 判定方法 |
|------|------|----------|
| AV - Attack Vector | `N`/`A`/`L`/`P` | 网络可远程触达用 `N`；同网段/相邻网络用 `A`；需要本地账户、shell、文件投递或本地执行用 `L`；需要物理接触用 `P` |
| AC - Attack Complexity | `L`/`H` | 利用条件稳定、无需竞态或罕见配置用 `L`；依赖竞态、复杂环境或难以满足的状态用 `H` |
| PR - Privileges Required | `N`/`L`/`H` | 无需认证用 `N`；低权限普通用户可利用用 `L`；需要管理员或高权限用 `H` |
| UI - User Interaction | `N`/`R` | 攻击者可自行完成利用用 `N`；需要受害者打开文件、点击链接或执行动作才触发用 `R` |
| S - Scope | `U`/`C` | 影响不越过原组件安全权限域用 `U`；能影响另一个权限域或安全主体用 `C` |
| C - Confidentiality | `H`/`L`/`N` | 大量或高敏感数据泄露用 `H`；有限数据泄露用 `L`；无保密性影响用 `N` |
| I - Integrity | `H`/`L`/`N` | 可任意修改关键数据或执行代码用 `H`；有限篡改用 `L`；无完整性影响用 `N` |
| A - Availability | `H`/`L`/`N` | 可稳定导致服务不可用或资源耗尽用 `H`；局部/短暂影响用 `L`；无可用性影响用 `N` |

## 分数到等级

| 分数 | 等级 |
|------|------|
| 0.0 | None |
| 0.1-3.9 | Low |
| 4.0-6.9 | Medium |
| 7.0-8.9 | High |
| 9.0-10.0 | Critical |

## 评分要求

1. 只对 `status=CONFIRMED` 的漏洞写入 `cvss_v3_1`。
2. `vector` 必须与 `metrics` 完全一致，顺序固定为 `AV/AC/PR/UI/S/C/I/A`。
3. 每个指标必须在 `metric_justification` 中写明基于源码或数据流的判断理由。
4. 如果证据不足，选择较保守的取值，并在对应 justification 中说明不确定性。
5. `verified_severity` 仍按既有置信度重评估规则填写；CVSS 的 `severity` 是独立的标准化风险等级，不替代置信度。
