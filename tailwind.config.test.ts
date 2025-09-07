import config from './tailwind.config';
import { describe, it, expect } from 'vitest';

describe('tailwind config', () => {
  it('exposes custom colors', () => {
    expect(config.theme?.extend?.colors?.primary).toBe('#4A90E2');
  });
});

