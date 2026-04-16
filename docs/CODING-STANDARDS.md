# Coding Standards

> **Related Documentation**
> - [Architecture](./ARCHITECTURE.md) - Design patterns these standards support
> - [Tech Stack](./TECH-STACK.md) - Tools that enforce these standards
> - [Setup Guide](./SETUP.md) - How to configure the development environment

## Code Style & Formatting

### Prettier Configuration

| Rule | Value |
|------|-------|
| Indentation | 2 spaces |
| Quotes | Single quotes |
| Trailing commas | Yes |
| Line width | 80 characters |
| Semicolons | Yes |
| Bracket spacing | Yes |
| Arrow function parens | Always |

Configuration lives in `.prettierrc.json` at the repository root.

### ESLint Rules

- **No `console.log`** — ESLint forbids all console statements
- **No inline styles** — ESLint enforces CSS classes over React inline styles
- **Import ordering** — builtin > external > internal > parent > sibling > index (alphabetical within groups)
- Flat config format in `eslint.config.ts`

### Pre-commit Hooks

Husky + lint-staged automatically run ESLint and Prettier on staged TypeScript files before commit. Husky is configured via the `prepare` script in `package.json`.

## Naming Conventions

### Files & Directories

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase, `.tsx` | `AllergyForm.tsx` |
| Hooks | camelCase with `use` prefix | `usePatientSearch.ts` |
| Services | camelCase with `Service` suffix | `medicationService.ts` |
| Stores | camelCase with `Store` suffix | `allergyStore.ts` |
| Styles | PascalCase with `.module.scss` | `AllergyForm.module.scss` |
| Tests | Match source with `.test.ts(x)` | `AllergyForm.test.tsx` |
| Constants | camelCase | `appConstants.ts` |
| Types | camelCase | `patientTypes.ts` |
| Translation keys | SCREAMING_SNAKE_CASE | `ALLERGY_FORM_TITLE` |

### Code

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `AllergyForm` |
| Functions | camelCase | `fetchPatient` |
| Variables | camelCase | `patientUUID` |
| Constants | camelCase or SCREAMING_SNAKE_CASE | `DEFAULT_LOCALE` |
| Types/Interfaces | PascalCase | `PatientDetails` |
| Enums | PascalCase (values: SCREAMING_SNAKE_CASE) | `ICON_SIZE.LG` |

## Component Patterns

### Structure

- **Functional components only** — no class components
- **Custom hooks** for business logic — in `hooks/` directories
- **SCSS Modules** for styles — `*.module.scss` files
- **Atomic design** in design system — atoms > molecules > organisms > templates

### Organization

Each component should be in its own directory:

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.module.scss
├── __tests__/
│   └── ComponentName.test.tsx
└── index.ts  (optional barrel export)
```

### React Best Practices

- Use `React.memo` for components that receive stable props
- Use `useMemo` for expensive computations and stable object references
- Use `useCallback` for event handlers passed as props
- Prefer composition over prop drilling

## State Management Patterns

| Pattern | When to Use |
|---------|-------------|
| React Query | Fetching/caching server data |
| Zustand stores | Form state that spans multiple components |
| React Context | App-wide config, user info, privileges |
| `useState` | Local component UI state |

### Zustand Store Convention

Stores live in `apps/clinical/src/stores/` and follow this pattern:

```typescript
import { create } from 'zustand';

interface AllergyStore {
  selectedAllergies: Allergy[];
  addAllergy: (allergy: Allergy) => void;
  reset: () => void;
}

export const useAllergyStore = create<AllergyStore>((set) => ({
  selectedAllergies: [],
  addAllergy: (allergy) =>
    set((state) => ({
      selectedAllergies: [...state.selectedAllergies, allergy],
    })),
  reset: () => set({ selectedAllergies: [] }),
}));
```

## API Layer Patterns

### Use Typed Helpers

Always use the typed HTTP helpers from `@bahmni/services`:

```typescript
import { get, post } from '@bahmni/services';

const patient = await get<Patient>(`/openmrs/ws/rest/v1/patient/${uuid}`);
const result = await post<Response, RequestBody>('/openmrs/ws/fhir2/R4/Bundle', bundle);
```

### Service Organization

Services are organized by domain in `packages/bahmni-services/src/`:

- Each service exports functions for specific API operations
- Services handle error transformation
- 401 responses are intercepted globally (redirect to login)

## Testing

### Framework & Tools

- **Jest** with **React Testing Library** and **jsdom** environment
- **jest-axe** for accessibility testing
- **90% coverage threshold** enforced (lines, branches, functions, statements)

### Test File Organization

- Test files: `*.test.ts` / `*.test.tsx`
- Location: `__tests__/` directories or co-located with source
- Mocks: `src/__mocks__/` directories

### Coverage Exclusions

Coverage thresholds do not apply to: `constants/`, `styles/`, `__mocks__/`, `types/`, `stories/`

### Testing Best Practices

- Test behavior, not implementation details
- Use `screen.getByRole`, `screen.getByText` over `getByTestId`
- Mock API calls, not internal functions
- Test error states and loading states
- Test accessibility with `jest-axe` where applicable

```typescript
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

test('renders allergy form accessible', async () => {
  const { container } = render(<AllergyForm />);
  expect(await axe(container)).toHaveNoViolations();
});
```

## Internationalization

### Rules

- **Never hardcode user-facing strings** — use translation keys
- Use `const { t } = useTranslation()` then `t('TRANSLATION_KEY')`
- Translation files: `public/locales/locale_[language].json`
- Namespace per app (clinical, registration)
- English fallback, language stored in localStorage under `NG_TRANSLATE_LANG_KEY`

### Translation Key Naming

Use SCREAMING_SNAKE_CASE with feature prefix:

```json
{
  "ALLERGY_FORM_TITLE": "Allergies",
  "ALLERGY_SEARCH_PLACEHOLDER": "Search for allergies",
  "MEDICATION_DOSAGE_INPUT_LABEL": "Dosage"
}
```

For complete i18n implementation details including namespace setup, config overrides, and migration, see [i18n Guide](./i18n-guide.md).

## Error Handling

1. **Service layer** — Handle API errors, provide meaningful error messages
2. **UI components** — Handle error states gracefully with user-friendly messages
3. **Notifications** — Use the notification system (`useNotification` hook or `notificationService`)
4. **Format errors** — Use `getFormattedError()` utility for consistent error formatting

For notification system details, see [Global Notification Guide](./global-notification-guide.md).

## Common Anti-Patterns to Avoid

- **Don't use `console.log`** — ESLint will reject it
- **Don't use inline styles** — Use SCSS Modules
- **Don't hardcode strings** — Use i18n translation keys
- **Don't create class components** — Only functional components
- **Don't bypass the API layer** — Use typed helpers from `@bahmni/services`
- **Don't couple ConsultationPad to widgets** — Use the consultation event system
- **Don't add direct query invalidation in ConsultationPad** — Use `dispatchConsultationSaved`
- **Don't import widget query keys into ConsultationPad** — Use the event system instead
- **Don't duplicate state** — Use the appropriate state layer (React Query, Zustand, Context, or useState)

## Pull Request Guidelines

- Ensure all tests pass (`yarn test:affected`)
- Ensure linting passes (`yarn lint:affected`)
- Ensure type checking passes (`yarn typecheck:affected`)
- Maintain 90% test coverage for new code
- Follow existing patterns in similar files
- Keep PRs focused — one feature or fix per PR

---
*Last updated: 2026-02-19*
