import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const logicDir = join(process.cwd(), 'src', 'logic');
const testFiles = readdirSync(logicDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();

let totalTests = 0;
let totalPass = 0;
let totalFail = 0;

console.log('=== Bonk Pop Test Suite ===');
for (const file of testFiles) {
  const relPath = `src/logic/${file}`;
  try {
    const out = execSync(`npx tsx --test ${relPath}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const testsMatch = out.match(/# tests (\d+)/);
    const passMatch = out.match(/# pass (\d+)/);
    const failMatch = out.match(/# fail (\d+)/);
    const t = testsMatch ? Number(testsMatch[1]) : 0;
    const p = passMatch ? Number(passMatch[1]) : 0;
    const f = failMatch ? Number(failMatch[1]) : 0;
    totalTests += t;
    totalPass += p;
    totalFail += f;
    console.log(`PASS  ${relPath.padEnd(34)} ${p}/${t} passed`);
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const out = (e.stdout ?? '') + '\n' + (e.stderr ?? '');
    const testsMatch = out.match(/# tests (\d+)/);
    const passMatch = out.match(/# pass (\d+)/);
    const failMatch = out.match(/# fail (\d+)/);
    const t = testsMatch ? Number(testsMatch[1]) : 1;
    const p = passMatch ? Number(passMatch[1]) : 0;
    const f = failMatch ? Number(failMatch[1]) : 1;
    totalTests += t;
    totalPass += p;
    totalFail += f;
    console.error(`FAIL  ${relPath.padEnd(34)} ${p}/${t} passed (${f} failed)`);
    console.error(out);
  }
}

console.log('--------------------------------------------------');
console.log(`TOTAL: ${totalPass}/${totalTests} passed, ${totalFail} failed across ${testFiles.length} test files.`);
if (totalFail > 0) {
  process.exit(1);
}
