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

This branch adds a voice-driven AI assistant that lets clinical staff register patients, search records, open consultations, and record diagnoses/medications/observations by speaking or typing.

### How it works

1. A microphone button appears in the Bahmni header.
2. Clicking it opens the Agent panel and starts listening (Web Speech API or local Whisper STT).
3. Speech is transcribed and sent to Claude Sonnet via the Anthropic API.
4. Claude calls structured tools (register patient, add diagnosis, etc.) that interact with the Bahmni/OpenMRS backend.

### Prerequisites

- All standard prerequisites above (Node.js, Yarn)
- An **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
- **Python 3.11+** and **ffmpeg** (only if using local Whisper STT)

### Setup

#### 1. Add your Anthropic API key

Create `ai-config.json` in the project root (already gitignored after the key was removed):

```json
{
  "anthropicApiKey": "sk-ant-..."
}
```

The webpack dev server reads this file and serves it at `/ai-config`. The agent loads the key from there at startup — no hardcoding required.

#### 2. Start the Whisper STT server (optional but recommended)

The local Whisper server replaces Chrome's cloud-based Web Speech API, which is often blocked on hospital networks.

```bash
cd whisper-server
pip install -r requirements.txt
python server.py
```

The server starts on `http://localhost:8765`. The webpack dev server proxies `/whisper-stt` to it automatically.

To use a larger (more accurate) model:

```bash
WHISPER_MODEL=medium python server.py
```

Alternatively, run via Docker:

```bash
docker build -t whisper-server ./whisper-server
docker run -p 8765:8765 whisper-server
```

#### 3. Start the frontend dev server

```bash
yarn dev
```

This starts the app at [http://localhost:3000](http://localhost:3000). The webpack dev server also handles the Anthropic proxy at `/anthropic-proxy/v1/messages` — no separate process needed for development.

#### 4. Use the Agent

1. Log in to Bahmni and navigate to any patient-facing screen.
2. Click the **microphone icon** in the header to open Agent Bahmni.
3. Speak or type a command, for example:
   - _"Register John Doe, male, born 1990"_
   - _"Search patient Ramesh Kumar"_
   - _"Add fever diagnosis"_
   - _"Add blood pressure 120 over 80"_
   - _"Submit consultation"_

The agent understands English, Hindi, and Hinglish (mixed Hindi-English).

### Architecture overview

| Component | Location | Port | Purpose |
|---|---|---|---|
| Frontend (webpack dev server) | `distro/` | 3000 | Bahmni UI + built-in Anthropic proxy |
| Whisper STT server | `whisper-server/` | 8765 | Local speech-to-text (faster-whisper) |
| Standalone Anthropic proxy | `anthropic-proxy/` | 3001 | Optional proxy for non-dev environments |
| Agent source | `distro/src/agent/` | — | React components, hooks, tools, stores |

### Standalone Anthropic proxy (non-dev / nginx environments)

When serving via nginx instead of the webpack dev server, the built-in proxy is unavailable. Run the standalone proxy:

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
```

### Security note

- Never commit a real API key to `ai-config.json`. The file contains a placeholder (`YOUR_ANTHROPIC_API_KEY_HERE`) — replace it locally only.
- The Anthropic proxy forwards the key from the client request — it is never stored server-side.

---

## License

[Add license information here]
