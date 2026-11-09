// Minimal, friendly HTML pages for respondents who can't enter a survey. Kept dependency-free;
// texts become translatable with DSA-406.

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);

export function messagePage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 16px;
    font: 18px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  main { max-width: 32rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
</style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body>
</html>`;
}

export const pages = {
  surveyNotFound: messagePage(
    'Survey not found',
    'This survey link is not valid. Please check the link in your invitation.',
  ),
  missingRespondentId: messagePage(
    'Link incomplete',
    'This survey link is missing information. Please open the survey again from your invitation.',
  ),
  providerUnavailable: messagePage(
    'Please try again shortly',
    'We could not start the survey right now. Please try again in a few minutes.',
  ),
};
