import { expect, test, type Page } from '@playwright/test';
import { ANSWERS, createTestSurvey, newPanelId } from '../support/survey.js';

// Every respondent path ends with exactly one end link (DSA-702). Each test checks the exact
// URL the browser lands on and the outcome stored in the database.

let survey: Awaited<ReturnType<typeof createTestSurvey>>;

test.beforeAll(async () => {
  survey = await createTestSurvey();
});

test.afterAll(async () => {
  await survey.remove();
});

async function start(page: Page, psid: string) {
  await page.goto(survey.entryUrl(psid));
  await page.getByRole('button', { name: 'Start' }).click();
}

async function answer(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
}

test('complete', async ({ page }) => {
  const psid = newPanelId();
  await start(page, psid);
  await answer(page, ANSWERS.qualifies);
  await answer(page, ANSWERS.openCell);
  await answer(page, ANSWERS.attentive);

  await expect(page).toHaveURL(survey.endLink(psid, 'complete'));
  await expect(page.getByRole('heading', { name: 'Mock Dynata: Complete' })).toBeVisible();
  expect(await survey.status(psid)).toBe('complete');
});

test('screen-out', async ({ page }) => {
  const psid = newPanelId();
  await start(page, psid);
  await answer(page, ANSWERS.screensOut);

  await expect(page).toHaveURL(survey.endLink(psid, 'screenout'));
  expect(await survey.status(psid)).toBe('screenout');
});

test('over-quota', async ({ page }) => {
  const psid = newPanelId();
  await start(page, psid);
  await answer(page, ANSWERS.qualifies);
  await answer(page, ANSWERS.fullCell);

  await expect(page).toHaveURL(survey.endLink(psid, 'overquota'));
  expect(await survey.status(psid)).toBe('overquota');
});

test('quality termination', async ({ page }) => {
  const psid = newPanelId();
  await start(page, psid);
  await answer(page, ANSWERS.qualifies);
  await answer(page, ANSWERS.openCell);
  await answer(page, ANSWERS.inattentive);

  await expect(page).toHaveURL(survey.endLink(psid, 'quality'));
  expect(await survey.status(psid)).toBe('quality');
});

test('duplicate entry', async ({ page }) => {
  const psid = newPanelId();
  await start(page, psid);
  await answer(page, ANSWERS.screensOut);
  await expect(page).toHaveURL(survey.endLink(psid, 'screenout'));

  // The same panelist opens the link again: sent away, never counted twice.
  await page.goto(survey.entryUrl(psid));
  await expect(page).toHaveURL((await survey.entryLinks(psid)).endLinks.quality);
  expect(await survey.respondents(psid)).toEqual([{ status: 'screenout' }]);
});

test('invalid signature', async ({ page }) => {
  const psid = newPanelId();
  const tampered = survey.entryUrl(psid).replace(`psid=${psid}`, `psid=${psid}X`);
  await page.goto(tampered);

  const links = await survey.entryLinks(`${psid}X`);
  await expect(page).toHaveURL(links.invalidLink);
  expect(await survey.respondents(`${psid}X`)).toEqual([]);
});
