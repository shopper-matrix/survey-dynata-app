import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('serves the admin login page', async () => {
    renderAt('/admin/login');
    // Admin screens are lazy-loaded; their first import can take over the default 1 s.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Survey admin' }, { timeout: 5000 }),
    ).toBeDefined();
  });

  it('sends unknown paths to the admin area, and signed-out visitors on to the login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ error: 'unauthorized' }, { status: 401 }))),
    );
    const router = renderAt('/somewhere');
    await vi.waitFor(
      () => {
        expect(router.state.location.pathname).toBe('/admin/login');
      },
      { timeout: 5000 },
    );
  });

  it('shows the documentation to signed-in admins, linked from the sidebar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ email: 'a@example.com', role: 'viewer' }))),
    );
    renderAt('/admin/docs');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dokumentation' }, { timeout: 5000 }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe(
      '/admin/docs',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Deployment' })).toBeDefined();
  });
});
