# Plan Mode

Plan mode restricts the agent to **read-only analysis**. No code is modified, no commands are run, and no files are created. The output is a detailed, actionable implementation plan.

## What the Agent Can Do

- Read files using `Read`, `Glob`, `Grep` tools
- Analyze codebase architecture and structure
- Create a detailed implementation plan with file paths and line numbers

## What the Agent Cannot Do

- Edit, create, or delete any files
- Run shell commands that modify the filesystem
- Start servers or run builds

## Instructions

The agent receives mode-specific instructions via the docs and system prompt. In plan mode, the agent must:

- Analyze the codebase and user request
- Provide a detailed implementation plan covering:
  - Which files to change (with specific paths)
  - What changes are needed in each file
  - Architectural decisions and reasoning
  - Potential pitfalls or edge cases
  - Implementation order
- If the user asks to modify code, respond: *"I'm in Plan Mode and cannot modify source code. Please switch to Normal mode to apply changes."*
- The plan should be detailed enough for Normal mode to execute directly

## Environment

- `PERMISSION_MODE=plan` is set, enforcing read-only at the environment level
- npm install, git operations, and server start are all skipped
- Typical duration: **2-3 minutes**

## Quick Response

When plan mode starts, the agent acknowledges with a message mentioning it will analyze the codebase and create a detailed plan without modifying any code.
