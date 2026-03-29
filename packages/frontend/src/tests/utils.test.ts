import { describe, it, expect } from 'vitest';
import { cn, truncateName } from '../lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
    expect(cn('a', true && 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts — last wins', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});

describe('truncateName', () => {
  it('leaves names under the cap unchanged', () => {
    expect(truncateName('Nic', 10)).toBe('Nic');
    expect(truncateName('exactly10c', 10)).toBe('exactly10c');
  });

  it('truncates names over the cap', () => {
    expect(truncateName('toolongname', 6)).toBe('toolon...');
  });

  it('handles empty string', () => {
    expect(truncateName('', 5)).toBe('');
  });
});
