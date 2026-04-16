# Tech Stack

> **Related Documentation**
> - [Architecture](./ARCHITECTURE.md) - How these technologies are used together
> - [Setup Guide](./SETUP.md) - How to install and configure these tools
> - [Coding Standards](./CODING-STANDARDS.md) - Conventions enforced by these tools

## Core

| Technology | Version | Purpose |
|-----------|---------|---------|
| [React](https://react.dev/) | 19.x | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Type-safe JavaScript |
| [React Router](https://reactrouter.com/) | 7.x | Declarative routing with lazy loading |

## Build & Workspace

| Technology | Version | Purpose |
|-----------|---------|---------|
| [Nx](https://nx.dev/) | 22.x | Monorepo orchestration, affected-only builds/tests/lints |
| [Webpack](https://webpack.js.org/) | 5.x | Module bundler, dev server, proxy config |
| [Yarn](https://yarnpkg.com/) | 1.22.x | Package management with workspaces |
| [Babel](https://babeljs.io/) | 7.x | JavaScript/TypeScript transpilation |

## UI & Design

| Technology | Version | Purpose |
|-----------|---------|---------|
| [IBM Carbon Design System](https://carbondesignsystem.com/) | 11.x | UI component library (buttons, tables, forms, notifications) |
| [SCSS Modules](https://sass-lang.com/) | - | Scoped component styling (`*.module.scss`) |
| [FontAwesome](https://fontawesome.com/) | 6.x | Icon library (via custom `BahmniIcon` component) |

## State Management

| Technology | Version | Purpose |
|-----------|---------|---------|
| [TanStack React Query](https://tanstack.com/query) | 5.x | Server state — API data fetching, caching (5min stale time), background refetching |
| [Zustand](https://zustand-demo.pmnd.rs/) | 5.x | Form state — medication, allergy, vaccination, condition stores |
| React Context | (built-in) | App-level context — clinical config, episode of care, user privileges, active practitioner |

## API & Data

| Technology | Purpose |
|-----------|---------|
| [Axios](https://axios-http.com/) | HTTP client with request/response interceptors |
| [FHIR R4](https://www.hl7.org/fhir/) | Healthcare interoperability standard (primary API for clinical data) |
| OpenMRS REST v1 | Legacy backend API (patient, encounter, config endpoints) |

## Internationalization

| Technology | Purpose |
|-----------|---------|
| [i18next](https://www.i18next.com/) | Core i18n framework |
| [react-i18next](https://react.i18next.com/) | React bindings (`useTranslation` hook) |
| [i18next-browser-languagedetector](https://github.com/i18next/i18next-browser-languageDetector) | Browser language detection |

## Testing

| Technology | Purpose |
|-----------|---------|
| [Jest](https://jestjs.io/) | Test runner and assertion framework |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | React component testing utilities |
| [jest-axe](https://github.com/nickcolley/jest-axe) | Accessibility testing |
| jsdom | Browser environment simulation |

## Code Quality

| Technology | Purpose |
|-----------|---------|
| [ESLint](https://eslint.org/) | Code linting (flat config format in `eslint.config.ts`) |
| [Prettier](https://prettier.io/) | Code formatting |
| [Husky](https://typicode.github.io/husky/) | Git hooks (pre-commit linting and formatting) |
| [lint-staged](https://github.com/lint-staged/lint-staged) | Run linters on staged files only |

## PWA & Offline

| Technology | Purpose |
|-----------|---------|
| [Workbox](https://developers.google.com/web/tools/workbox) | Service worker tooling for offline support |

## Development Tools

| Technology | Purpose |
|-----------|---------|
| [Storybook](https://storybook.js.org/) | Component development, documentation, and visual testing |
| Docker & Docker Compose | Local backend services (OpenMRS, MySQL, etc.) |
| GitHub Container Registry | Docker image distribution for backend services |

## Key Dependencies

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "react-router-dom": "^7.12.0",
  "@tanstack/react-query": "^5.85.5",
  "zustand": "^5.0.7",
  "@bahmni/form2-controls": "0.0.3-dev.24"
}
```

---
*Last updated: 2026-02-19*
