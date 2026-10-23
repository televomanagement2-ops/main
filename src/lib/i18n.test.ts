import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { flatDictionary } from './i18n';

// Every key the interface asks for must exist, in every language, with the
// same {{placeholders}}: a missing key renders as the raw key on screen.

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Strings shaped like keys that are not translations (localStorage keys). */
const NOT_KEYS = new Set(['settings.locationAllowed', 'settings.analyticsAllowed']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const en = flatDictionary('en');
const enKeys = new Set(Object.keys(en));
// colors.* is listed explicitly: its keys are only ever built from a template.
const namespaces = [...new Set([...enKeys].map((key) => key.split('.')[0]).concat('colors'))].join('|');
const files = sourceFiles(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('has every key the code uses', () => {
    // A quoted 'namespace.some.key': passed to t() directly or through a variable.
    const literal = new RegExp(`['"]((?:${namespaces})\\.[\\w.]*\\w)['"]`, 'g');
    const missing: string[] = [];
    for (const { path, text } of files) {
      for (const [, key] of text.matchAll(literal)) {
        // tCount() keys are objects of plural forms; `other` is the fallback.
        if (!enKeys.has(key) && !enKeys.has(`${key}.other`) && !NOT_KEYS.has(key)) missing.push(`${key} (${path})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has a section behind every key built from a template', () => {
    // `admin.inventory.reason.${reason}` needs an admin.inventory.reason section.
    const template = new RegExp('`((?:' + namespaces + ')(?:\\.\\w+)*)\\.\\$\\{', 'g');
    const missing: string[] = [];
    for (const { path, text } of files) {
      for (const [, prefix] of text.matchAll(template)) {
        if (![...enKeys].some((key) => key.startsWith(`${prefix}.`))) missing.push(`${prefix} (${path})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each(['it', 'es', 'fr'] as const)('%s has the same keys and placeholders as English', (language) => {
    const dict = flatDictionary(language);
    const keys = Object.keys(dict);
    expect([...enKeys].filter((key) => !(key in dict))).toEqual([]);
    expect(keys.filter((key) => !enKeys.has(key))).toEqual([]);
    const mismatched = keys.filter(
      (key) => enKeys.has(key) && placeholders(dict[key]).join() !== placeholders(en[key]).join(),
    );
    expect(mismatched).toEqual([]);
  });
});
