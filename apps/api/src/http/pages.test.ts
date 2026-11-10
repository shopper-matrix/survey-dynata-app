import { describe, expect, it } from 'vitest';
import { messagePage } from './pages.js';

describe('messagePage', () => {
  it('renders a complete, mobile-friendly HTML page', () => {
    const html = messagePage('Title', 'Message');
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('<h1>Title</h1><p>Message</p>');
  });

  it('escapes text', () => {
    expect(messagePage('<b>', `"x" & 'y'`)).toContain(
      '<h1>&#60;b&#62;</h1><p>&#34;x&#34; &#38; &#39;y&#39;</p>',
    );
  });
});
