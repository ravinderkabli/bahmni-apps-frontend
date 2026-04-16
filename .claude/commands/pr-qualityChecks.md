---
version: 1.0.0
last-updated: 2026-02-25
description: Holistic PR readiness check — AC coverage, test quality, snapshot/a11y/integration coverage, and existing pattern advisory
model: opus
---

## Context

You are helping a developer verify their PR is ready for review.
Input: $ARGUMENTS (PR number OR JIRA ID)

**Note:** This command does NOT check code coverage percentage — that is already enforced at 90% by `yarn test --coverage` in CI. This command focuses on requirement coverage and test quality.

**Before doing anything else, read the team's testing guide in full:** `.claude/developersGuideForTests.md`

### Phases for This Command
1. Validation — Resolve input, get diff, fetch JIRA details (ACs, description, comments)
2. Context Gathering — Categorize files, map source to test files, identify module area
3. Coverage Analysis (6 parallel agents) — Requirements, unit/RTL, snapshot, accessibility, integration, existing patterns
4. Evaluate Results — Aggregate findings, determine readiness
5. Generate Report — Create local readiness report
6. Developer Review — Review findings and next steps

---

## Status Definitions

| Status | Symbol | Meaning |
|--------|--------|---------|
| **COVERED** | ✅ | Sufficient test coverage exists |
| **MISSING** | ❌ | Testable gap with no coverage — must fix before requesting review |
| **UI AUTOMATION CANDIDATE** | 🤖 | Requires browser-level E2E testing — valid outcome, add to automation backlog |
| **QUALITY ISSUE** | ⚠️ | Tests exist but violate team patterns from the developers guide |
| **N/A** | — | This test type does not apply to this file |

---

## Files Created

| File | Purpose | Delete After |
|------|---------|--------------|
| `PR_[number]_readiness.md` | Readiness report | PR merged or report outdated |
| `[JIRA_ID]_readiness.md` | Used if no PR number available | PR merged or report outdated |
| `PR_[number]_readiness_[YYYYMMDD_HHMMSS].md` | Backup of previous run | When no longer needed |

---

## Workflow

### Phase 1: Validation

**Display progress tracker** with Phase 1 in progress.

**Actions:**

1. **Verify git repository** — if not a git repo, stop with error.

2. **Resolve input and get the diff:**
   - If a **PR number** given: `gh pr view <number> --json number,title,headRefName,body` then `gh pr diff <number>`
   - If a **JIRA ID** given: find matching branch with `git branch -a | grep -i "<JIRA_ID>"`, use `git diff origin/main...HEAD`
   - If **no input**: use `git diff origin/main...HEAD` on current branch
   - If diff is empty: stop with error — "No changes found. Make sure you have commits on your branch."

3. **Extract JIRA ID:**
   - From PR title, branch name, or PR body: match pattern `[A-Z]+-[0-9]+`
   - If provided directly as argument: use as-is
   - If not found: warn "JIRA ID not found — requirements coverage check will be skipped" and continue

4. **Fetch JIRA details:**
   - Use MCP to fetch: summary, description, technical details, and formal acceptance criteria
   - Also fetch all JIRA comments — comments often contain clarifications, decisions, or requirements agreed upon during refinement that supersede the original description
   - Store formal ACs, description/technical details, and comments separately
   - If MCP unavailable or JIRA ID not found: warn and skip Agent 1

**On completion display:**
```
✓ Source: PR #[number] | Branch: [branch]  (or "Branch diff — PR not yet created")
✓ JIRA: [ID] — [summary]
✓ Formal ACs: [count] found  (or "None — will infer from description/comments")
✓ Diff: [X] files changed
```

---

### Phase 2: Context Gathering

**Display progress tracker** with Phase 2 in progress.

**Actions:**

1. **Categorize all changed files from the diff:**
   - **Source files**: `.ts`, `.tsx`, `.js`, `.jsx` — excluding `*.test.*` and `*.spec.*`
   - **Test files**: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
   - **Config/infra**: `*.json`, `*.yml`, `*.yaml`, `*.config.*`
   - **Styles**: `*.css`, `*.scss`

2. **Classify each source file by type** (used by agents to determine applicable test types):
   - **React component**: `.tsx` file containing JSX
   - **Custom hook**: filename starts with `use`, no JSX
   - **Pure utility/helper**: `.ts` file, no JSX, no direct API calls
   - **API/service**: `.ts` file making HTTP calls or using React Query
   - **Full-page layout**: top-level page component, no reusable UI logic
   - **Config/types/constants**: no executable logic

3. **Map each source file to its test file:**
   - Convention: same directory, same base name + `.test.tsx` / `.test.ts`
   - Check if the test file exists in the diff OR already on disk
   - Mark as "NOT FOUND" if neither exists

4. **Identify the module/feature area:**
   - From changed source files, determine the enclosing feature directory
   - Example: `apps/clinical/src/components/forms/medications/` → module area is that directory
   - Used by Agent 6 to scope existing pattern analysis

**On completion display:**
```
Files changed:
  React components:  [count]
  Hooks:             [count]
  Utilities/services:[count]
  Test files:        [count]
  Config/styles:     [count]

Source files WITHOUT a test file: [list, or "none"]
Module area for pattern check: [path]
```

Proceed directly to Phase 3.

---

### Phase 3: Coverage Analysis (6 Parallel Agents)

**Display progress tracker** with Phase 3 in progress, showing each agent's status.

**Launch 6 agents in parallel using Task tool (model: sonnet).**

**Each agent receives:**
- Full PR diff
- Source file → type classification → test file mapping (including "NOT FOUND")
- JIRA formal ACs, description/technical details, and comments
- Full content of `.claude/developersGuideForTests.md`

**Each agent returns findings in this format:**
```
- Finding: [brief description]
  Status: [COVERED / MISSING / UI AUTOMATION CANDIDATE / QUALITY ISSUE / N/A]
  Subject: [requirement text OR source file path]
  Evidence: [test name/file that covers it, or explanation of gap]
  Recommendation: [specific action — what test to add, what to fix]
```

---

**Agent 1: Requirements Coverage**

Purpose: For each testable requirement (from formal ACs or inferred), determine whether a test in the PR verifies it.

**Step 1 — Determine requirements source:**

**If formal ACs exist:**
- Use them as-is, numbered as provided
- Read JIRA comments for any clarifications or additions that refine the ACs
- Note: "Analysis based on formal Acceptance Criteria"

**If no formal ACs but description/comments are present:**
- Read the description, technical details, and all comments carefully
- Comments are especially valuable — they often capture decisions made during refinement
- Extract testable requirements: what should the code do? What behaviour changes for the user?
- List as inferred requirements with the prefix "Inferred:"
- Note: "⚠️ No formal ACs — requirements inferred from JIRA description and comments. Verify accuracy."

**If no JIRA data at all:**
- Return single finding: N/A — "No requirements available, skipping AC coverage check"

**Step 2 — Classify each requirement:**

**COVERED ✅:** At least one test verifies the requirement's user-observable outcome

**UI AUTOMATION CANDIDATE 🤖** — when ANY apply:
- Multi-page navigation flow
- Requires real browser APIs (file upload, print, camera, geolocation)
- Authentication or session flows spanning the full app
- Spans multiple independent modules/apps that cannot be rendered in isolation
- Complete end-to-end user journey with multiple discrete steps
- Cross-browser compatibility or responsive layout behaviour
- **This is a valid, expected outcome — add to E2E automation backlog**

**MISSING ❌:** Testable with RTL/unit tests but no covering test exists in the PR

Output one finding per requirement.

---

**Agent 2: Unit / RTL / Hook Coverage**

Purpose: For each new or modified source file, verify tests exist at the right layer, with the right depth, and follow team quality patterns.

**Step 1 — Determine applicable test layer by file type:**

| File type | Expected tests |
|-----------|---------------|
| Pure utility/helper | Unit tests — individual function inputs/outputs |
| React component | RTL integration test — render + user interaction |
| Custom hook | `renderHook` test |
| API/service function | Integration test with `jest.fn()` or MSW mocks |
| Full-page layout | Likely UI Automation Candidate — evaluate case by case |
| Config/types/constants with no logic | N/A |

**Step 2 — Check test depth (if test file found):**
- **Happy path**: Tests for expected inputs producing expected outputs
- **Sad path**: Tests for invalid inputs, error conditions, API failures
- **Edge cases**: Boundary conditions (empty arrays, null values, 0/max values)
- Flag if a test file exists but only covers the happy path with no error/edge case tests

**Step 3 — Check test quality patterns (against developers guide):**

| Check | Violation | Correct pattern |
|-------|-----------|-----------------|
| Query method | `querySelector`, CSS class selectors, `getByTestId` when a role exists | `getByRole`, `getByLabelText`, `getByText` |
| Interaction method | `fireEvent` for clicks, typing, or form input | `userEvent.setup()` + `await user.click/type()` |
| Async handling | `setTimeout`, hardcoded sleep, `getBy*` for async elements | `findBy*` or `waitFor` |
| Provider isolation | `QueryClient` shared at module level or across tests | New `QueryClient` per test with `retry: false` |
| Async userEvent | `userEvent` interactions not `await`-ed | `await` all `user.*` calls |
| Test organisation | No describe block structure in complex suites | Happy Path / Sad Path / Edge Cases describe blocks |

**Step 4 — Classify:**
- **COVERED ✅**: Test exists, right layer, good depth, no pattern violations
- **QUALITY ISSUE ⚠️**: Test exists but has pattern violations or missing depth — list each specifically
- **MISSING ❌**: No test file found for a file that requires one
- **UI AUTOMATION CANDIDATE 🤖**: Full-page layout not suitable for RTL isolation
- **N/A**: Config/types/constants

---

**Agent 3: Snapshot Coverage**

Purpose: Verify snapshot tests exist for UI components where they add value, and are not added where they would be fragile or redundant.

**This project's snapshot policy:**
- Snapshots are used sparingly — only where they catch unintended structural regressions
- E2E visual regression tests are planned; avoid duplicating their coverage with snapshots
- RTL tests that already verify DOM structure make snapshots redundant

**When to flag as MISSING ❌:**
1. New reusable design-system components (molecules/atoms) without snapshots
   - Example: `SelectedItem`, `BoxWHeader`, `SortableDataTable`
2. Form components with multiple distinct visual states (empty, filled, error, disabled)
   - Example: `MedicationsForm`, `AllergiesForm`
3. List item components that render dynamic data
   - Example: `SelectedMedicationItem`, `SelectedAllergyItem`
4. Components with significant conditional rendering that changes DOM structure
5. No other test verifies the visual structure

**When to mark as N/A —:**
1. Layout/template components (structural containers, page shells)
   - Example: `ActionAreaLayout`, page layouts
2. Pure logic changes — no DOM structure changed
3. Style-only changes (CSS/SCSS with no JSX changes)
4. Third-party library integrations where rendering is library-controlled
5. RTL tests already verify the DOM structure adequately
6. E2E visual tests planned for this feature

**Checks:**
- Identify UI components (`.tsx`, `.jsx`) in changed files
- Distinguish reusable components from structural layouts
- Check for `.snap` files or `toMatchSnapshot()` / `toMatchInlineSnapshot()`
- If snapshots exist: verify they cover the component's different states/props

**What NOT to flag:** Utility functions, API/service files, config files, non-UI hooks, layout templates

---

**Agent 4: Accessibility Coverage**

Purpose: Verify accessibility tests exist for all new or modified UI components.

**Checks:**

- **A11y test existence**
  - Check for `jest-axe` usage: `toHaveNoViolations`, `axe(container)`
  - Verify `expect.extend(toHaveNoViolations)` is present in the test file
  - A11y tests should cover all meaningful component states (default, loading, error, filled)

- **Keyboard navigation**
  - Check that keyboard interactions are tested where the component has interactive elements
  - Look for `userEvent.tab()`, `userEvent.keyboard('{Enter}')`, `userEvent.keyboard('{Escape}')` patterns
  - Verify focus management is tested for modals, dropdowns, dialogs

- **ARIA and semantic HTML**
  - Check that tests use `getByRole` and `getByLabelText` — this implicitly verifies correct ARIA usage
  - Look for assertions on `aria-label`, `aria-expanded`, `aria-disabled` where applicable
  - Flag if a component has interactive elements but tests never use `getByRole`

- **What NOT to flag:** Non-UI utility functions, hooks without UI, API/service files, config files

**Classify:**
- **COVERED ✅**: A11y test with `jest-axe` exists and covers meaningful states
- **MISSING ❌**: New/modified UI component with no a11y test
- **N/A**: Non-UI file (utility, hook, service, config)

---

**Agent 5: Integration Coverage**

Purpose: Verify integration tests cover API calls, component interactions, and state management introduced by the PR.

**Checks:**

- **API integration**
  - For changes involving API calls (React Query, axios, fetch): verify integration tests exist
  - Look for MSW (`msw`, `setupServer`, `rest.get/post`) or `jest.fn()` mock patterns
  - Verify tests cover: successful response, error response, loading state
  - Check that request parameters and response handling are verified

- **Component integration**
  - Verify parent-child component interactions are tested (prop passing, callbacks)
  - Check tests cover component composition scenarios
  - Look for tests that render a parent with its children and verify the interaction

- **State management**
  - For changes using React Query: verify query/mutation behaviour is tested
  - For changes using Context: verify context values are correctly provided and consumed in tests
  - Check that state changes across component boundaries are tested

- **What NOT to flag:** Components with no API calls, no shared state, and no child component interactions — N/A for purely presentational components

**Classify:**
- **COVERED ✅**: Integration scenarios are tested
- **MISSING ❌**: API calls or component interactions exist in the code but no integration tests cover them
- **N/A**: Purely presentational component, pure utility function, or no integration points

---

**Agent 6: Existing Test Pattern Advisory**

Purpose: Check whether existing test files in the same module area follow team patterns. Prevents developers from copying anti-patterns from nearby tests.

**Important: This agent's findings are ADVISORY ONLY — they never affect the overall PR readiness verdict.**

**Scope:** Only the module/feature directory identified in Phase 2. Do NOT scan the entire repo.

**Step 1 — Find existing test files in scope:**
- Search for `*.test.ts`, `*.test.tsx` in the module area directory
- Exclude test files already in the PR diff (those are covered by Agents 2–5)
- Read up to 10 existing test files — prioritise those closest to the changed files

**Step 2 — Check for anti-patterns:**
- `fireEvent` instead of `userEvent` for interactions
- `querySelector` or CSS class selectors instead of `getByRole`
- `getByTestId` where a semantic role exists
- `QueryClient` instance shared at module level across tests
- `setTimeout` / hardcoded sleep for async assertions
- Missing `await` on `userEvent` calls

**Step 3 — Report only files with actual violations.** For each: note "Do not copy this pattern. When modifying this file, update to: [correct pattern]."

---

### Phase 4: Evaluate Results

**Display progress tracker** with Phase 4 in progress.

**Actions:**

1. Aggregate all findings from all 6 agents
2. Remove duplicates (same file/requirement flagged by multiple agents)
3. Organise into sections: Requirements, Coverage by file (unit/snapshot/a11y/integration), Quality Issues, Advisory

4. **Determine overall PR readiness** (Agents 1–5 only; Agent 6 never contributes):

| Overall Status | Condition |
|----------------|-----------|
| **✅ READY FOR REVIEW** | Zero MISSING items across all 5 coverage agents |
| **❌ NEEDS TESTS** | One or more MISSING items in any of Agents 1–5 |

**Notes:**
- QUALITY ISSUES do not block review — flag and let the developer decide
- UI AUTOMATION CANDIDATES are valid outcomes — not failures
- Agent 6 findings are advisory and never change the verdict

---

### Phase 5: Generate Report

**Display progress tracker** with Phase 5 in progress.

**Actions:**
1. If report file already exists, rename it to backup: `PR_[number]_readiness_[YYYYMMDD_HHMMSS].md`
2. Create report with this structure:

```markdown
# PR Readiness Report

**PR**: #[number] — [title]  (or "Branch: [branch] — PR not yet created")
**JIRA**: [ID] — [summary]
**Date**: [YYYY-MM-DD]
**Requirements source**: Formal ACs  /  ⚠️ Inferred from description & comments  /  N/A

---

## Overall Status: ✅ READY FOR REVIEW  /  ❌ NEEDS TESTS

| | ✅ Covered | ❌ Missing | 🤖 UI Automation | ⚠️ Quality Issues |
|-|-----------|-----------|-----------------|------------------|
| Requirements | X | X | X | — |
| Unit / RTL / Hook | X | X | X | X |
| Snapshot | X | X | — | — |
| Accessibility | X | X | — | — |
| Integration | X | X | — | — |

---

## Requirements Coverage

> [If inferred] ⚠️ No formal ACs found. Requirements inferred from JIRA description and comments — verify accuracy.

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | [text] | ✅ COVERED | [test file — test name] |
| 2 | [text] | ❌ MISSING | [what to add] |
| 3 | [text] | 🤖 UI AUTOMATION CANDIDATE | [reason] |

---

## Test Coverage by File

| Source File | Unit/RTL | Snapshot | A11y | Integration |
|-------------|----------|----------|------|-------------|
| src/components/Button.tsx | ✅ | ✅ | ✅ | N/A |
| src/utils/format.ts | ❌ MISSING | N/A | N/A | N/A |
| src/hooks/usePatient.ts | ✅ | N/A | N/A | ✅ |
| src/components/Form.tsx | ⚠️ QUALITY | ✅ | ❌ MISSING | ✅ |

---

## UI Automation Candidates

Not failures — add these to the E2E automation backlog:

1. **[Requirement or flow name]**
   - Reason: [why RTL/unit cannot cover this]
   - Suggested E2E scenario: [what to automate]

---

## Quality Issues (should fix before review)

| File | Test Type | Issue | Fix |
|------|-----------|-------|-----|
| [file] | RTL | `fireEvent.click` used | `await user.click(button)` with `userEvent.setup()` |
| [file] | RTL | Querying by CSS class | `getByRole('button', { name: /submit/i })` |
| [file] | RTL | Only happy path tested | Add sad path (API error) and edge cases |

---

## Advisory: Anti-patterns in Existing Tests (do not copy)

| File | Anti-pattern | Correct pattern |
|------|-------------|-----------------|
| [file] | `fireEvent` for interactions | `userEvent` |
| [file] | Shared `QueryClient` at module level | New `QueryClient` per test |

---

## PR Testing Checklist

- [ ] At least one test per requirement (or flagged as UI Automation Candidate)
- [ ] Elements queried by accessible role (`getByRole`) not CSS classes or `data-testid`
- [ ] User interactions use `userEvent`, not `fireEvent`
- [ ] Async elements use `findBy*` or `waitFor`, not `getBy*` or `setTimeout`
- [ ] React Query wrapped in isolated `QueryClientProvider` with `retry: false` per test
- [ ] Tests cover happy path, sad path (errors), and edge cases
- [ ] New reusable design-system components have snapshot tests
- [ ] New UI components have `jest-axe` accessibility tests
- [ ] Components with API calls have integration tests covering success and error states
- [ ] Tests check user-observable behaviour, not internal state or implementation details
```

---

### Phase 6: Developer Review

**Display progress tracker** with Phase 6 in progress.

**Show summary:**
```
Overall: ✅ READY FOR REVIEW  /  ❌ NEEDS TESTS

  ❌ Missing (must fix):          [count] across [list of categories]
  🤖 UI Automation Candidates:   [count]  (add to backlog)
  ⚠️ Quality Issues:             [count]  (should fix)
  ✅ Covered:                    [count]

  Advisory: [count] anti-pattern(s) in existing tests nearby
```

**Use AskUserQuestion:**
- Question: "What would you like to do next?"
- Header: "Action"
- Options: "Done" | "View full report"

**Based on response:**
- "Done" → Display completion and stop
- "View full report" → Display report inline, then re-present menu
- "Other" → User can ask questions, then re-present menu

**On completion display:**
- Report saved to: `[file path]`
- If **NEEDS TESTS**: "Add missing tests, then re-run `/pr-readiness-check` to verify."
- If **READY FOR REVIEW**: "You're good to go. Run `/submit-pr [JIRA_ID]` to create your PR."
- If **UI Automation Candidates**: "Add [count] scenario(s) to the E2E automation backlog before closing the ticket."
- If **advisory findings**: "Heads up: [count] anti-pattern(s) found in nearby tests — avoid copying them."

---

## Error Handling

| Error | Action |
|-------|--------|
| Not a git repo | Stop with error |
| Diff is empty | Stop: "No changes found on this branch." |
| JIRA ID not found | Warn, skip Agent 1, continue with Agents 2–6 |
| MCP unavailable | Warn, skip Agent 1, continue with Agents 2–6 |
| No ACs and no description | Warn: "JIRA ticket has no content — requirements check skipped." Continue. |
| No source files in diff | Warn: "Only config/style changes found — no source file analysis needed." |
| `gh` not installed | Stop: "gh CLI required. Install: brew install gh" |
| `gh` not authenticated | Stop: "Run: gh auth login" |
| PR not found | Fall back to `git diff origin/main...HEAD` and warn |

---

## Guidelines

- **Testing Trophy, not Test Pyramid**: Integration tests (RTL) are the primary layer. Unit tests are for pure logic only. Do not flag missing unit tests for React components — an RTL integration test is correct.
- **No code coverage % checks**: `yarn test --coverage` already enforces 90% in CI. Do not repeat that check here.
- **AC-first thinking**: Tests are proof that requirements work. Coverage % alone is not enough.
- **Inferred requirements are best-effort**: Flag clearly when requirements are inferred from description/comments — the developer must validate them.
- **UI Automation Candidates are valid outcomes**: Never treat them as failures. They belong in the E2E backlog.
- **Snapshot policy**: Sparingly — reusable design-system components and multi-state forms yes; layout templates and pages no.
- **Focus strictly on the diff**: Only analyse new and modified files. Never flag pre-existing untested code.
- **Agent 6 is advisory only**: Existing test anti-patterns never change the READY/NEEDS TESTS verdict.
- **Quality issues do not block**: Flag them clearly; the developer decides whether to fix before review.
- **N/A is not a failure**: Config, types, constants, layout templates — mark N/A, never MISSING.
