import { describe, it, expect } from 'vitest';
import { extractMentions } from './mentions.util';

describe('Mentions Utility', () => {
  it('extracts a single email mention', () => {
    const result = extractMentions('Hello @alice@example.com, please review.');
    expect(result).toEqual(['alice@example.com']);
  });

  it('extracts multiple mentions uniquely', () => {
    const result = extractMentions('Hi @alice@example.com and @bob@example.com. @Alice@example.com again.');
    expect(result.sort()).toEqual(['alice@example.com', 'bob@example.com'].sort());
  });

  it('ignores malformed syntax', () => {
    const result = extractMentions('Email alice@example.com without at-sign, or @invalid-email');
    expect(result).toEqual([]);
  });
});
