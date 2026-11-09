import { describe, expect, it } from 'vitest';
import { QuestionType, RespondentStatus, SurveyStatus } from '@survey-dynata/shared/db';

// Guards the generated, browser-safe exports that web and api rely on.
describe('generated database types', () => {
  it('exports the enums from the Prisma schema', () => {
    expect(Object.values(SurveyStatus)).toEqual(['draft', 'test', 'live', 'closed']);
    expect(RespondentStatus.screenout).toBe('screenout');
    expect(QuestionType.maxdiff).toBe('maxdiff');
  });
});
