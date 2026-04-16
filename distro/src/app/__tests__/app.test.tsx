import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock external packages whose ESM dist cannot be transformed by Jest.
jest.mock('@bahmni/widgets', () => ({
  AppContextProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@bahmni/design-system', () => ({
  Loading: () => null,
}));

// Mock the voice agent so routing tests don't pull in the full agent tree
// (which has cross-package deep imports that aren't resolvable in this context).
jest.mock('../../agent/components/AgentBahmni', () => ({
  __esModule: true,
  default: () => null,
}));

import App from '../app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );
    expect(baseElement).toBeTruthy();
  });
});
