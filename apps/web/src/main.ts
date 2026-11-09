import { pageTitle } from './title.js';

document.title = pageTitle();

const statusEl = document.querySelector<HTMLElement>('#api-status');

async function showApiStatus(): Promise<void> {
  if (!statusEl) return;
  try {
    const res = await fetch('/api/health');
    const body = (await res.json()) as { status: string; database: string };
    statusEl.textContent = `${body.status} (database: ${body.database})`;
  } catch {
    statusEl.textContent = 'unreachable';
  }
}

void showApiStatus();
