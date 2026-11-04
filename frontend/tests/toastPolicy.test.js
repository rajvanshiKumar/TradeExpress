import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.resolve('src', file), 'utf8');

function sourceFiles(dir = path.resolve('src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

describe('Pop-up notifications', () => {
  it('shows only errors and warnings, not confirmations of a click', () => {
    assert.match(read('contexts/NotificationContext.jsx'), /if \(tone !== 'error' && tone !== 'warning'\) return null;/);
  });

  it('never labels a failure as a success, which would hide it from the user', () => {
    const problem = /\b(fail|failed|error|unable|could not|cannot|must be|maximum of|invalid)\b/i;
    const hidden = [];
    for (const file of sourceFiles()) {
      for (const [line] of fs.readFileSync(file, 'utf8').matchAll(/showToast\([^\n]*\);/g)) {
        const shown = /,\s*['"](error|warning)['"]\s*\)/.test(line) || /\?\s*['"](error|warning)['"]/.test(line);
        const text = /showToast\((['"`])(.*?)\1/.exec(line)?.[2] || '';
        if (!shown && (problem.test(text) || /\.message/.test(line))) hidden.push(`${path.basename(file)}: ${line.trim().slice(0, 90)}`);
      }
    }
    assert.deepEqual(hidden, []);
  });

  it('keeps guidance visible, so these buttons do not seem to do nothing', () => {
    assert.match(read('hooks/useContactSupplier.js'), /Switch to a buyer account[^\n]*'warning'/);
    assert.match(read('pages/supplier/SupplierPayments.jsx'), /No transaction records available to export\.', 'warning'/);
    assert.match(read('components/forms/SupplierRegisterForm.jsx'), /Logo upload failed\.', 'error'/);
  });
});
