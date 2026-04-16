# AI Task Analysis Workflow

This document defines the standard flow for Claude to follow when analyzing or implementing a task in this repository.

## Task Analysis Flow

### 1. Gather Context (parallel)
- **Unblocked `research_task`** — pull Jira AC, PR history, Slack discussions, prior decisions for the ticket
- **Read relevant `docs/`** — architecture, coding standards for the affected area
- **Memory check** — review prior session context for related work

### 2. Explore Code (parallel with step 1)
- **Glob/Grep** to locate affected files and components
- **Read** key files to understand current patterns
- **Unblocked `unblocked_context_engine`** for any specific entity that looks non-obvious

### 3. Synthesize
- Map Jira AC → code locations
- Identify gaps, risks, or constraints
- Note existing patterns to follow or avoid

### 4. Plan
- Produce a concrete implementation plan
- Call out open questions before writing any code
- Estimate test coverage needed (90% threshold)

### 5. Implement → Validate
- Write code following existing patterns
- Run `yarn test:affected` and `yarn lint:affected`
- Self-review with `/dev-quality-pilot` before handing off

## Key Principle

Steps 1 and 2 run **in parallel** — do not wait for Unblocked before starting code exploration, or vice versa.
