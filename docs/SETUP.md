# Setup Guide

> **Related Documentation**
> - [Tech Stack](./TECH-STACK.md) - What you'll be installing
> - [Architecture](./ARCHITECTURE.md) - How the pieces fit together
> - [Coding Standards](./CODING-STANDARDS.md) - How to write code once you're set up

## Prerequisites

### Required Software

| Software | Version | Verify |
|----------|---------|--------|
| [Node.js](https://nodejs.org/) | v22.x or later | `node --version` |
| [Yarn](https://yarnpkg.com/getting-started/install) | v1.22.x or later | `yarn --version` |
| [Git](https://git-scm.com/downloads) | Latest | `git --version` |
| [Docker](https://docs.docker.com/get-docker/) | Latest | `docker --version` |
| [Docker Compose](https://docs.docker.com/compose/install/) | Latest | `docker compose --version` |

### GitHub Personal Access Token (PAT)

You need a GitHub PAT to access the GitHub Container Registry for Docker images:

1. Go to [GitHub Token Settings](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Select scopes:
   - `repo` (Full control of private repositories)
   - `read:packages` (Download packages from GitHub Package Registry)
4. Copy and save your token immediately — it won't be shown again

## Step 1: Clone Repositories

```bash
# Clone the backend Docker setup
git clone git@github.com:bahnew/bahmni-docker.git
# Or using HTTPS:
# git clone https://github.com/bahnew/bahmni-docker.git

# Clone the frontend (in a separate directory)
git clone https://github.com/Bahmni/bahmni-apps-frontend.git
```

## Step 2: Authenticate with GitHub Container Registry

```bash
export GITHUB_PAT=<your-token-here>
echo $GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Replace `GITHUB_PAT` with your actual token and `YOUR_GITHUB_USERNAME` with your GitHub username.

## Step 3: Start Backend Services

```bash
cd bahmni-docker/bahmni-standard

# Start all EMR components
docker compose --env-file .env.dev up -d

# Verify containers are running
docker ps
```

Wait for all services to start. Verify by navigating to http://localhost/bahmni/home, logging in, registering a patient, and starting a visit.

## Step 4: Install Frontend Dependencies

```bash
cd bahmni-apps-frontend
yarn
```

## Development Setup Options

### Option A: Hot Reload (Recommended for Development)

Fastest development experience with hot module reloading:

```bash
yarn dev
```

The dev server runs at http://localhost:3000. The webpack config proxies `/openmrs` and `/bahmni_config` to the local Docker backend.

**Authentication Setup:**

1. Login to Bahmni EMR in another tab (http://localhost/bahmni/home)
2. Open browser DevTools (F12) > Application tab > Cookies
3. Copy the `JSESSIONID` cookie value
4. In your localhost:3000 tab, create a cookie with:
   - Name: `JSESSIONID`
   - Value: (paste the copied value)

Changes to source code are immediately reflected via hot module reloading.

### Option B: Docker Volume Mount (Production-like)

Build locally and mount into the Docker container:

1. **Configure `.env.dev`** in `bahmni-docker/bahmni-standard`:
   - Set `BAHMNI_APPS_FRONTEND_PATH` to the **root directory** of your `bahmni-apps-frontend` repo
   - The Docker volume mount automatically appends `/distro/dist/`
   - If using custom Bahmni configuration, update `CONFIG_VOLUME` to point to your config directory (e.g., `../bahmni-config/standard-config`)
   - The volume mount is **already active** in `docker-compose.yml`:
     ```yaml
     bahmni-apps-frontend:
       volumes:
         - "${BAHMNI_APPS_FRONTEND_PATH:?}/distro/dist/:/usr/local/apache2/htdocs/bahmni-new"
     ```

2. **Build the application**:
   ```bash
   yarn build
   # Or build only the shell app:
   nx build distro
   ```

3. **Start/restart Docker services**:
   ```bash
   cd bahmni-docker/bahmni-standard
   docker compose --env-file .env.dev up -d bahmni-apps-frontend
   ```

4. Access at http://localhost/bahmni/home. Rebuild with `yarn build` and refresh browser to see changes.

## Verify Setup

After completing setup, verify everything works:

```bash
# Run tests
yarn test

# Run linting
yarn lint

# Type checking
yarn typecheck

# Build
yarn build
```

## Storybook

```bash
# Start Storybook dev server (port 6006)
yarn storybook

# Build Storybook as static site
yarn build-storybook
```

## Running Individual Project Tests

```bash
# Test a single project
nx test @bahmni/clinical

# Test a single file
nx test @bahmni/clinical -- --testPathPattern="AllergyForm"

# Test only affected projects
yarn test:affected
```

## Linting & Formatting

```bash
# Lint all projects
yarn lint

# Auto-fix lint issues
yarn lint:fix

# Format code
yarn format
```

## Code Quality Tools

### Pre-commit Hooks

Husky is automatically configured via `yarn install` (the `prepare` script). Pre-commit hooks run lint-staged, which applies ESLint and Prettier to staged TypeScript files.

### ESLint

Configured using flat config format in `eslint.config.ts`. Applies to all JavaScript and TypeScript files with recommended configs for JS, TS, and React.

### Prettier

Configured in `.prettierrc.json`:
- 2-space indentation
- 80 character line width
- Trailing commas
- Semicolons
- Single quotes

## Troubleshooting

### Authentication Failures with GitHub Container Registry

- Ensure your PAT has `repo` and `read:packages` scopes
- Check that your token hasn't expired
- Verify correct username in `docker login`

### Docker Compose Errors

- Ensure all required environment variables are set in `.env.dev`
- Check for port conflicts with other running services
- Run `docker compose logs <service-name>` to inspect failures

### API Authorization Issues (Dev Server)

- Verify the `JSESSIONID` cookie is correctly set in localhost:3000
- Ensure the backend Docker services are running
- Check that the session hasn't expired (re-login and copy fresh cookie)

### Build Issues

- Clear caches: `yarn clean` (runs `nx reset && rm -rf dist coverage`)
- Reinstall dependencies: `rm -rf node_modules && yarn`
- Check Node.js version: must be v22.x or later

## Getting Help

- [GitHub Issues](https://github.com/Bahmni/bahmni-apps-frontend/issues)
- [Bahmni Community Forums](https://talk.openmrs.org/c/software/bahmni/35)

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Carbon Design System](https://carbondesignsystem.com/)
- [Nx Documentation](https://nx.dev/)
- [Webpack Documentation](https://webpack.js.org/concepts/)
- [Docker Documentation](https://docs.docker.com/)
- [Bahmni Documentation](https://bahmni.atlassian.net/wiki/spaces/BAH/overview)

---
*Last updated: 2026-02-19*
