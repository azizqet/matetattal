import { describe, expect, test } from '@jest/globals';

declare const __dirname: string;
const dirName = __dirname;

// قاعدة ثابتة: لا writingDirection على أي TextInput (كان عاملاً مشتركاً في مشاكل الكتابة على الآيفون)
describe('حماية خانات الإدخال', () => {
  test('لا writingDirection في أنماط أو خصائص TextInput بأي ملف', () => {
    type Ent = { name: string; isDirectory: () => boolean };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as { readdirSync: (d: string, o: { withFileTypes: true }) => Ent[]; readFileSync: (f: string, e: string) => string };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as { join: (...p: string[]) => string };
    const root = path.join(dirName, '..', '..');
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); } else if (p.endsWith('.tsx')) files.push(p);
    });
    walk(root);
    const bad = files.filter((f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /(input|phoneInput|ltr|rtl|code)\s*:\s*\{[^}]*writingDirection/.test(src) || /<TextInput[^>]*writingDirection/s.test(src);
    });
    expect(bad).toEqual([]);
  });
});
