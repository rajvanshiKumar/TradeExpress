// Creates the admin password hash for VITE_ADMIN_PASSWORD_HASH using the exact WebCrypto algorithm.
import readline from 'node:readline';
import { hashPassword } from '../src/utils/passwords.js';

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = (text) => { if (!rl.stdoutMuted || text.includes(question)) rl.output.write(text); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const password = process.argv[2] ?? (await ask('Admin password: '));
if (!password || password.length < 6) {
  console.error('Use an admin password of at least 6 characters.');
  process.exit(1);
}

const hash = await hashPassword(password);
console.log('\nAdd this line to .env or .env.local:\n');
console.log(`VITE_ADMIN_PASSWORD_HASH=${hash}`);
