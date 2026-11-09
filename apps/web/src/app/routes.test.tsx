import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const screens: [path: string, heading: RegExp][] = [
  ['/', /Survey Dynata App/],
  ['/survey/welcome', /Grocery Shopping Habits 2026/],
  ['/survey/single', /How old are you/],
  ['/survey/multi', /Where have you bought groceries/],
  ['/survey/grid', /How much do you agree/],
  ['/survey/open', /What would make your weekly shop easier/],
  ['/survey/number', /How many times did you shop/],
  ['/survey/rating', /How likely are you to recommend/],
  ['/survey/end/complete', /Thank you!/],
  ['/survey/end/screenout', /Thank you for your time/],
  ['/admin/surveys', /Surveys/],
  ['/admin/dashboard', /Grocery Shopping Habits 2026/],
];

describe('prototype routes', () => {
  it.each(screens)('%s renders its main heading', async (path, heading) => {
    renderAt(path);
    // Admin screens are lazy-loaded; their first import can take over the default 1 s.
    const found = await screen.findByRole(
      'heading',
      { level: 1, name: heading },
      { timeout: 5000 },
    );
    expect(found).toBeDefined();
  });

  it('blocks Next until a question is answered, then moves on', async () => {
    const user = userEvent.setup();
    const router = renderAt('/survey/single');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toBe('Please choose one option.');

    await user.click(screen.getByRole('radio', { name: '25–34' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(router.state.location.pathname).toBe('/survey/multi');
  });

  it('screens out respondents under 18', async () => {
    const user = userEvent.setup();
    const router = renderAt('/survey/single');

    await user.click(screen.getByRole('radio', { name: 'Under 18' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(router.state.location.pathname).toBe('/survey/end/screenout');
  });
});
