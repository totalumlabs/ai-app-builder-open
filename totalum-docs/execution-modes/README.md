# Startum Execution Modes

Startum supports 4 execution modes that control how the AI agent operates. Each mode has specific capabilities and restrictions.

```typescript
type StartumAgentMode = 'normal' | 'testing' | 'plan' | 'no-stop';
```

| Mode | Purpose | Can Modify Code | Runs Tests | Duration |
|------|---------|----------------|------------|----------|
| **Normal** | Full development & deployment | Yes | No | 7-15 min |
| **Testing** | Implement + auto-test with Playwright | Yes | Yes | +5 min |
| **Plan** | Read-only codebase analysis | No | No | 2-3 min |
| **No-Stop** | Plan + auto-execute sequentially | No (Phase 1), Yes (Phase 2) | Yes (Phase 2) | Varies |

---

## Mode Details

- [Plan Mode](./plan-mode.md) - Read-only analysis and implementation planning
- [No-Stop Mode](./no-stop-mode.md) - Automated multi-step development
- Testing Mode - See **docs/testing-project** for full documentation

### Normal Mode (Default)

Normal mode is the default execution mode. The agent has full access to:
- Read and modify source code files
- Create and delete files
- Run shell commands (npm install, npm run build, etc.)
- Git operations
- Deploy the application

The agent implements the requested features, runs type checks and builds, and deploys automatically.

**IMPORTANT:** In normal mode, do NOT run Playwright browser tests on the current project unless the user explicitly requests testing. Playwright MCP is still available for other purposes (visiting external websites, taking screenshots of reference sites, extracting content from URLs, etc).

---

## How Modes Are Triggered

When a prompt is sent to Startum, the mode is specified in the `StartumConfig`:

```typescript
interface StartumConfig {
    prompt?: string;
    inputFiles: { isLogo: 'yes' | 'no', name: string, imageDescription: string, url: string }[];
    mode?: StartumAgentMode;
}
```

Mode-specific instructions are delivered via the docs (synced to `docs/execution-modes/` on the sandbox). The mode is passed in `StartumConfig.mode` and the system prompt is adjusted accordingly by the controller.

### Mode-Specific Setup

| Action | Normal | Testing | Plan | No-Stop |
|--------|--------|---------|------|---------|
| npm install | Yes | Yes | Skipped | Skipped |
| Git operations | Yes | Yes | Skipped | Skipped |
| npm start / preview URL | Yes | Yes | Skipped | Skipped |
| Playwright install | No | Yes | No | No |
| Permission mode | Default | Default | `plan` | `plan` |

### UI Visibility

The mode selector is shown to users based on the organization setting:
```typescript
// organization.interface.ts
showMode?: boolean  // Show agent mode selector in AI aside UI
```
