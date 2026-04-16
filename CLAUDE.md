# Claude Code Instructions

## Repository Overview

Bahmni Apps Frontend is a React 19 + TypeScript monorepo for the Bahmni EMR system, using Nx for workspace orchestration, Yarn workspaces for package management, and IBM Carbon Design System for UI.

## Documentation Index

- [Architecture](./docs/ARCHITECTURE.md) - System design, routing, state management, API layer
- [Tech Stack](./docs/TECH-STACK.md) - Technologies and versions
- [Coding Standards](./docs/CODING-STANDARDS.md) - Code style, testing, i18n conventions
- [Setup Guide](./docs/SETUP.md) - Getting started and environment setup
- [AI Workflow](./docs/AI-WORKFLOW.md) - Task analysis and implementation flow for AI assistants

## AI Assistant Guidelines

### Before Making Changes

- Read the relevant `docs/` files linked above before modifying unfamiliar areas
- Check existing patterns in similar files first — follow what exists
- Run `yarn test:affected` and `yarn lint:affected` after changes
- Ensure 90% coverage threshold is met for new code

### Testing Requirements

- Unit tests for all new components and functions using Jest + React Testing Library
- Test files go in `__tests__/` directories or co-located as `*.test.ts(x)`
- Use `jest-axe` for accessibility testing where applicable
- Mocks go in `src/__mocks__/` directories

### Common Commands

```bash
# Development
yarn dev                          # Start dev server on port 3000

# Testing
yarn test                         # Run all tests
yarn test:affected                # Run tests for affected packages only
yarn test:coverage                # Run tests with coverage report
yarn test:watch                   # Run tests in watch mode
nx test @bahmni/clinical          # Run tests for a single project
nx test @bahmni/clinical -- --testPathPattern="AllergyForm"  # Run a single test file

# Linting
yarn lint                         # Lint all projects
yarn lint:fix                     # Lint and auto-fix all projects
yarn lint:affected                # Lint affected projects only

# Type checking
yarn typecheck                    # Type-check all projects
yarn typecheck:affected           # Type-check affected projects only

# Building
yarn build                        # Build all projects
yarn build:affected               # Build affected projects only
nx build distro                   # Build the shell app only
```

### File Locations

```
distro/                     # Shell app — entry point, routing, webpack config
  webpack.config.js         # Dev server (port 3000), proxies /openmrs and /bahmni_config
apps/
  clinical/                 # Clinical consultation module (lazy-loaded)
    src/stores/             # Zustand stores (medication, allergy, vaccination, condition)
    src/components/         # Clinical UI components
    src/providers/          # React Context providers
    src/contexts/           # React Contexts (ClinicalConfigContext, ClinicalAppContext)
  registration/             # Patient registration module (lazy-loaded)
packages/
  bahmni-design-system/     # Atomic design UI components (atoms/molecules/organisms/templates)
  bahmni-services/          # Shared API services, utilities, i18n, error handling
    src/api/                # Axios HTTP client with interceptors
    src/events/             # Consultation event system (dispatchConsultationSaved, useSubscribeConsultationSaved)
    src/i18n/               # Translation service and initialization
    src/AppointmentService/ # Appointment search, status updates, upcoming/past (REST + SQL API)
  bahmni-widgets/           # Reusable clinical widgets (SearchPatient, LabInvestigation, etc.)
src/                        # Root shared source code
  components/               # Shared UI components (not feature-specific)
  displayControls/          # Clinical data visualization components
  hooks/                    # Shared custom React hooks
  layouts/                  # Page layout components
  providers/                # Shared context providers
  services/                 # Shared API services
  constants/                # Application-wide constants
  contexts/                 # Shared React contexts
  types/                    # Shared TypeScript type definitions
  utils/                    # Shared utility functions
  __mocks__/                # Test mocks
  __tests__/                # Test files
```

**Import aliases**: `@bahmni/clinical-app`, `@bahmni/registration-app`, `@bahmni/services`, `@bahmni/design-system`, `@bahmni/widgets`

### Repository-Specific Preferences

- Use SCSS Modules (`*.module.scss`) for component styles — no inline styles
- Use `const { t } = useTranslation()` then `t('TRANSLATION_KEY')` for all user-facing text
- Use SCREAMING_SNAKE_CASE for translation keys (e.g., `ALLERGY_FORM_TITLE`)
- Functional components with hooks only — no class components
- PascalCase component names, `.tsx` extension
- Prettier: 2-space indent, single quotes, trailing commas, 80 char width, semicolons
- Import ordering: builtin > external > internal > parent > sibling > index (alphabetical within groups)
- API calls use typed helpers from `@bahmni/services`: `get<T>()`, `post<T, D>()`, `put()`, `patch()`, `del()`
- Server state with TanStack React Query v5, form state with Zustand, app context with React Context

### Carbon Design System

The UI is built on IBM Carbon Design System v1 (`@carbon/react` v1.83.0, white theme).

#### Component Usage

- Always import Carbon components from `@carbon/react`, icons from `@carbon/icons-react`
- Use wrapped versions from `@bahmni/design-system` (which add `testId` and portal support) — do **not** import Carbon directly in feature code when a wrapper exists
- Prefer wrapped atoms/molecules: `Button`, `Modal`, `TextInput`, `Dropdown`, `ComboBox`, `Tag`, `ToastNotification`, `DataTable`, `Tabs`, `Accordion`, `Toggletip`, `Loading`, `SkeletonText`

```tsx
// Correct — use design system wrappers
import { Button, Modal, TextInput } from '@bahmni/design-system';

// Only use direct Carbon imports for components not yet wrapped
import { Stack, Grid, Column } from '@carbon/react';
import { Close } from '@carbon/icons-react';
```

#### Button Kinds

Use Carbon's `kind` prop — never create custom styled buttons:

```tsx
<Button kind="primary">Save</Button>
<Button kind="secondary">Cancel</Button>
<Button kind="tertiary">Reset</Button>
<Button kind="ghost">Learn more</Button>
<Button kind="danger">Delete</Button>
```

#### Layout

Use Carbon's Grid system for responsive layouts:

```tsx
<Grid>
  <Column sm={4} md={8} lg={12}>...</Column>
  <Column sm={4} md={8} lg={4}>...</Column>
</Grid>
```

Use `Stack` for consistent spacing between elements instead of margin utilities.

#### SCSS Tokens

Always use Carbon SCSS tokens — never hardcode colors, spacing, or font sizes:

```scss
@use '@carbon/react/scss/spacing' as *;   // $spacing-04, $spacing-05, $spacing-06
@use '@carbon/react/scss/colors' as *;    // $gray-20, $text-primary, $border-subtle
@use '@carbon/react/scss/type' as *;      // @include type-style('heading-03')
@use '@carbon/react/scss/breakpoint' as *; // @include breakpoint-down(lg)
```

#### Notifications

Use `ToastNotification` for transient feedback, `InlineNotification` for persistent inline messages. Pass `kind` as `'success' | 'error' | 'warning' | 'info'`.

#### New Design System Components

When adding a new reusable Carbon wrapper in `packages/bahmni-design-system/`:
- Place atoms (single component) in `src/atoms/`, molecules (composite) in `src/molecules/`
- Add `testId` prop mapping to `data-testid`
- Export from `src/index.ts`

### Don't Do This

- Don't use `console.log` — ESLint forbids console statements
- Don't use inline styles — ESLint enforces CSS classes
- Don't use class components — only functional components with hooks
- Don't hardcode user-facing strings — use i18n translation keys
- Don't bypass the API layer — use the typed helpers from `@bahmni/services`
- Don't modify `distro/webpack.config.js` unless changing build/proxy configuration
- Don't add direct query cache invalidation in `ConsultationPad` — use the consultation event system
- Don't import widget query keys into `ConsultationPad` — use `dispatchConsultationSaved` instead
- Don't create custom button, input, modal, or table components — Carbon provides these
- Don't hardcode colors, spacing, or font sizes — use Carbon SCSS tokens
- Don't import Carbon directly in feature code when a `@bahmni/design-system` wrapper exists

---
*Last updated: 2026-02-19*
