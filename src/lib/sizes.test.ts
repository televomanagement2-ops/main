import { describe, expect, it } from 'vitest';
import { SIZE_LABELS, SIZE_PRESETS, isSizeLabel, normalizeSize, parseStock, sizeLabelKey } from './sizes';

describe('size labels', () => {
  it('knows every label the database accepts', () => {
    expect(SIZE_LABELS).toEqual(['size', 'measure', 'length', 'shoe_size', 'ring_size', 'waist']);
    expect(isSizeLabel('waist')).toBe(true);
    expect(isSizeLabel('colour')).toBe(false);
  });

  it('falls back to "size" for an unknown label', () => {
    expect(sizeLabelKey('shoe_size')).toBe('sizes.label.shoe_size');
    expect(sizeLabelKey('nonsense')).toBe('sizes.label.size');
    expect(sizeLabelKey(null)).toBe('sizes.label.size');
  });

  it('every preset uses a known label and lists distinct sizes', () => {
    for (const preset of SIZE_PRESETS) {
      expect(isSizeLabel(preset.label)).toBe(true);
      expect(new Set(preset.sizes).size).toBe(preset.sizes.length);
    }
  });
});

describe('parsers', () => {
  it('normalizes whitespace in a size', () => {
    expect(normalizeSize('  50   cm ')).toBe('50 cm');
  });

  it('accepts whole numbers from 0 to the cap only', () => {
    expect(parseStock(' 12 ')).toBe(12);
    expect(parseStock('0')).toBe(0);
    expect(parseStock('-1')).toBeNull();
    expect(parseStock('1.5')).toBeNull();
    expect(parseStock('')).toBeNull();
    expect(parseStock('1000001')).toBeNull();
  });
});
