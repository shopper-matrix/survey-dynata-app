import { describe, expect, it } from 'vitest';
import { chooseLanguage, translateQuestion } from './translations.js';

const translations = {
  de: {
    text: 'Wie alt sind Sie?',
    labels: {
      a: 'Ja',
      'x.left': 'trocken',
      lowLabel: 'gar nicht',
      'xAxis.left': 'Müsli',
    },
  },
};

describe('translateQuestion', () => {
  it('translates the text and labels by id, keeping order and ids', () => {
    const config = {
      options: [
        { id: 'a', label: 'Yes' },
        { id: 'b', label: 'No' },
      ],
      pairs: [{ id: 'x', left: 'dry', right: 'juicy' }],
      lowLabel: 'not at all',
      xAxis: { left: 'muesli', right: 'sweets' },
    };
    const result = translateQuestion('How old are you?', config, translations, 'de');
    expect(result.text).toBe('Wie alt sind Sie?');
    expect(result.config.options).toEqual([
      { id: 'a', label: 'Ja' },
      { id: 'b', label: 'No' },
    ]);
    expect(result.config.pairs).toEqual([{ id: 'x', left: 'trocken', right: 'juicy' }]);
    expect(result.config.lowLabel).toBe('gar nicht');
    expect(result.config.xAxis).toEqual({ left: 'Müsli', right: 'sweets' });
  });

  it('leaves the question unchanged without a translation for the language', () => {
    const config = { options: [{ id: 'a', label: 'Yes' }] };
    expect(translateQuestion('Q?', config, translations, 'fr')).toEqual({ text: 'Q?', config });
    expect(translateQuestion('Q?', config, translations, null)).toEqual({ text: 'Q?', config });
  });
});

describe('chooseLanguage', () => {
  const offered = ['de', 'en'];
  it('prefers the link parameter, then the browser, then the main language', () => {
    expect(chooseLanguage(offered, 'de', 'en', 'de-DE')).toBe('en');
    expect(chooseLanguage(offered, 'de', null, 'fr-FR,en-US;q=0.8')).toBe('en');
    expect(chooseLanguage(offered, 'de', 'it', 'fr-FR')).toBe('de');
    expect(chooseLanguage(offered, 'de', null, undefined)).toBe('de');
  });
});
