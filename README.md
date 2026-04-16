# GIDS demo setup: run `./setup.sh` to get started quickly.

# Bahmni Apps Frontend

A React TypeScript monorepo application for Bahmni applications, built with Nx, Webpack, and Carbon Design System. This application includes PWA support for offline capabilities.

# About Bahmni
Bahmni is an open-source healthcare information system designed to serve healthcare providers in resource-limited settings. It combines electronic medical records (EMR), hospital information management, and clinical workflows into a unified platform. Bahmni is built on OpenMRS and focuses on making healthcare delivery more efficient and patient-centric. The platform follows FHIR (Fast Healthcare Interoperability Resources) standards to ensure interoperability with other healthcare systems.   

## Features

- **React** - UI library for building user interfaces
- **Carbon Design System** - IBM's open-source design system
- **Webpack** - Module bundler for modern JavaScript applications
- **React Router** - Declarative routing for React applications
- **i18n Support** - Internationalization for multiple languages
- **Display Controls** - Reusable clinical data visualization components

## Prerequisites

- Node.js (v18.x or later recommended)
- Yarn (v1.22.x or later recommended)

## Getting Started

### Installation

```bash
# Install dependencies
yarn
```

### Detailed Setup Guide

For a comprehensive setup guide including development environments, Docker configuration, authentication setup, and troubleshooting, please refer to our [Setup Guide](docs/setup-guide.md).

### Additional Documentation

- [Frontend Architecture](docs/architecture.md) - A comprehensive overview of the Bahmni Apps Frontend architecture
- [Project Structure](docs/project-structure.md) - A high-level overview of the project structure
- [i18n Guide](docs/i18n-guide.md) - Internationalization implementation details
- [Sortable Data Table Guide](docs/sortable-data-table-guide.md) - Usage of the sortable data table component
- [Global Notification Guide](docs/global-notification-guide.md) - Using the notification system

### Building for Production

```bash
# Build the application
yarn build 
```

The build artifacts will be stored in the `dist/` directory.

### Development

```bash
# Start the development server
yarn nx serve distro
```

This will start the development server at [http://localhost:3000](http://localhost:3000).

### Linting

```bash
# Run ESLint to check for code quality issues
yarn lint

# Fix ESLint issues automatically
yarn lint:fix
```

For a more detailed explanation of the project structure and architecture, see [Architecture Documentation](docs/architecture.md) and [Project Structure Documentation](docs/project-structure.md).

## Scripts

- `yarn dev` - Start the development server
- `yarn build` - Build the application for production
- `yarn test` - Run tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage report
- `yarn lint` - Run ESLint to check for code quality issues
- `yarn lint:fix` - Fix ESLint issues automatically
- `yarn format` - Format code with Prettier

## Technologies

- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Carbon Design System](https://carbondesignsystem.com/) - IBM's design system
- [Webpack](https://webpack.js.org/) - Module bundler
- [React Router](https://reactrouter.com/) - Routing library
- [i18next](https://www.i18next.com/) - Internationalization framework
- [Jest](https://jestjs.io/) - Testing framework
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - React testing utilities
- [ESLint](https://eslint.org/) - Code quality tool
- [Prettier](https://prettier.io/) - Code formatter
- [Workbox](https://developers.google.com/web/tools/workbox) - PWA tooling

---

## Agent Bahmni — Voice AI Assistant (GIDS Branch)

This branch adds two AI features on top of standard Bahmni:

- **Agent Bahmni** — a voice/text assistant that registers patients, searches records, opens consultations, and records diagnoses, medications, and observations by speaking or typing.
- **Clinical Insights** — an AI-powered panel on the consultation page that streams evidence-based recommendations for the patient's active conditions (requires the `bahmni-ai` backend service).

### How Agent Bahmni works

1. A floating chat panel appears on every page.
2. Click the microphone to speak, or type a command directly.
3. Speech is transcribed (Web Speech API or local Whisper) and sent to Claude Sonnet via the Anthropic API.
4. Claude calls structured tools (register patient, search, add diagnosis, etc.) that interact with the OpenMRS FHIR API.

### How Clinical Insights works

1. A "Clinical Insights" panel appears on the patient consultation page.
2. Click **Generate** to stream AI recommendations for the patient's conditions.
3. The panel calls the `bahmni-ai` Python service (`localhost:8090`), which fetches FHIR data, loads clinical guidelines, and runs inference via an LLM.

### Prerequisites

| Requirement | For what | Where to get it |
|---|---|---|
| Node.js v22+ / Yarn v1.22+ | Frontend | Standard setup above |
| **Anthropic API key** (`sk-ant-...`) | Agent Bahmni + Ask Questions | [console.anthropic.com](https://console.anthropic.com) |
| **`bahmni-ai` Python service** | Clinical Insights panel | Clone the [`bahmni-ai`](https://github.com/Bahmni/bahmni-ai) repo separately |
| Python 3.11+ + ffmpeg | Local Whisper STT (optional) | [python.org](https://python.org), [ffmpeg.org](https://ffmpeg.org) |

> **Clinical Insights without `bahmni-ai`**: The panel renders but "Generate" will silently fail (connection error). This is expected — Clinical Insights is a separate service. Agent Bahmni and the voice tools work without it.

### Setup

#### Quick start (recommended)

Run the interactive setup script:

```bash
./setup.sh
```

The script walks through:
1. **Anthropic API key** — prompts for your `sk-ant-...` key and writes it to `ai-config.json`.
2. **Frontend dependencies** — runs `yarn install` if `node_modules` is missing.
3. **Whisper STT server (optional)** — choose a model size, writes `whisper-server/.env`, installs Python deps.

At the end it prints the exact commands to start each service. Then continue with the **`bahmni-ai` backend** step below.

#### Manual steps

**Step 1 — Add your Anthropic API key**

Open `ai-config.json` in the project root and replace the placeholder:

```json
{
  "anthropicApiKey": "sk-ant-..."
}
```

The webpack dev server serves this file at `/ai-config`. The agent and Clinical Insights panel load the key from there at startup — no hardcoding or environment variables needed.

> **Important**: `ai-config.json` is listed in `.gitignore`. Never commit a real key. If you accidentally do, rotate the key immediately at [console.anthropic.com](https://console.anthropic.com).

**Step 2 — Start the `bahmni-ai` backend (for Clinical Insights)**

Clone and start the service in a separate terminal:

```bash
git clone https://github.com/Bahmni/bahmni-ai.git
cd bahmni-ai
# Follow the README there for Python env setup and configuration
python -m uvicorn app.main:app --host 0.0.0.0 --port 8090
```

The webpack dev server proxies `/bahmni-ai` → `http://localhost:8090` automatically. If `bahmni-ai` is not running, the Clinical Insights panel shows "Connection error" — this does not affect Agent Bahmni.

**Step 3 — Start the Whisper STT server (optional)**

Whisper replaces Chrome's cloud-based Web Speech API, which is often blocked on hospital networks.

```bash
cd whisper-server
pip install -r requirements.txt
python server.py
```

Starts on `http://localhost:8765`. The dev server proxies `/whisper-stt` to it automatically.

To choose a model size, set `WHISPER_MODEL` in `whisper-server/.env` or inline:

```bash
WHISPER_MODEL=medium python server.py
```

Available sizes: `tiny` (~75 MB), `small` (~465 MB, default), `medium` (~1.5 GB), `large` (~3 GB).

Or run via Docker:

```bash
docker build -t whisper-server ./whisper-server
docker run -p 8765:8765 whisper-server
```

**Step 4 — Start the frontend**

```bash
yarn dev
```

Starts at [http://localhost:3000](http://localhost:3000). The webpack dev server also handles the Anthropic proxy at `/anthropic-proxy/v1/messages` — no separate process needed for development.

**Step 5 — Use the Agent**

1. Log in to Bahmni and navigate to any screen.
2. Click the chat panel in the bottom-right header area to open Agent Bahmni.
3. Speak or type, for example:
   - _"Register John Doe, male, born 1990"_
   - _"Search patient Ramesh Kumar"_
   - _"Add fever diagnosis"_
   - _"Add blood pressure 120 over 80"_
   - _"Submit consultation"_

The agent understands English, Hindi, and Hinglish (mixed Hindi-English).

### Architecture overview

| Component | Repo / Location | Port | Required for |
|---|---|---|---|
| Frontend (webpack dev server) | `distro/` | 3000 | Everything |
| `bahmni-ai` Python service | `bahmni-ai` repo | 8090 | Clinical Insights |
| Whisper STT server | `whisper-server/` | 8765 | Local voice input (optional) |
| Standalone Anthropic proxy | `anthropic-proxy/` | 3001 | nginx deployments only |
| Agent source | `distro/src/agent/` | — | — |

### Standalone Anthropic proxy (nginx / non-dev environments)

When serving via nginx instead of the webpack dev server, the built-in Anthropic proxy is unavailable. Run the standalone Node.js proxy:

```bash
cd anthropic-proxy
node server.js
```

Or via Docker:

```bash
docker build -t anthropic-proxy ./anthropic-proxy
docker run -p 3001:3001 anthropic-proxy
```

Then add to your nginx config:

```nginx
location /anthropic-proxy/ {
    proxy_pass http://localhost:3001/;
}

location /bahmni-ai/ {
    proxy_pass http://localhost:8090/;
}
```

### Known issues (GIDS branch)

| Issue | Impact | Workaround / Status |
|---|---|---|
| **"New Consultation" crash** — `ClinicalInsights` has no error boundary; any render error takes down the whole consultation page | Page crash on consultation load if `ClinicalInsights` throws | Wrap `<ClinicalInsights />` in an `<ErrorBoundary>` in `ConsultationPage.tsx:270` |
| **Agent `start_encounter` navigates to wrong route** — tool navigates to `/clinical/<uuid>/consultation` but the route is `/:patientUuid` | Agent opens a blank page instead of the consultation | Fix `targetPath` in `distro/src/agent/tools/startEncounterTool.ts:43` to `/clinical/<uuid>` |
| **Deep imports from `@bahmni/clinical-app` fail in production builds** — `addDiagnosisTool` and `addMedicationTool` import from `@bahmni/clinical-app/stores/...` which is not in the package `exports` map | Agent diagnosis/medication tools silently broken in production; `yarn typecheck` reports errors in `distro/` | Works in `yarn dev` (webpack alias). Production builds require either adding `exports` entries to `apps/clinical/package.json` or moving the shared Zustand stores into a separate importable package |
| **`yarn typecheck` reports errors in `distro/`** | TypeScript check fails for agent tools | Known — does not affect `yarn dev` or the clinical/registration apps. Run `nx typecheck @bahmni/clinical` to check only the clinical app |

### Security note

- `ai-config.json` is gitignored — your API key stays local only.
- Never commit a real key. If you accidentally do, rotate it immediately at [console.anthropic.com](https://console.anthropic.com).
- The Anthropic proxy strips all headers before forwarding — your key is never logged or stored server-side.

---

## License

[Add license information here]
