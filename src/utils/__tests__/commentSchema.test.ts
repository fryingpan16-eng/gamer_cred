import { COMMENT_MAX_LENGTH, commentSchema } from '../reviewSchemas';

describe('commentSchema (migration 000043)', () => {
  it('trims, and rejects empty, too long, or objectionable comments', () => {
    expect(commentSchema.parse('  nice review  ')).toBe('nice review');
    expect(commentSchema.safeParse('   ').success).toBe(false);
    expect(commentSchema.safeParse('x'.repeat(COMMENT_MAX_LENGTH + 1)).success).toBe(false);
    expect(commentSchema.safeParse('x'.repeat(COMMENT_MAX_LENGTH)).success).toBe(true);
    expect(commentSchema.safeParse('you are a n1gger').success).toBe(false);
  });
});
