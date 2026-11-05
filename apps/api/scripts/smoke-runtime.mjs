import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';

// Reserve a free host port, then release it before starting the compiled API.
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);

const child = spawn(process.execPath, ['dist/main.js'], {
  cwd: new URL('../', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    SESSION_SECRET: randomBytes(32).toString('hex'),
    // HTTP availability must work even with an unreachable PostgreSQL server.
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unavailable',
  },
  stdio: 'ignore',
});
const exited = once(child, 'exit');
let spawnError;
child.on('error', (error) => {
  spawnError = error;
});

try {
  const deadline = Date.now() + 60_000;
  let response;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null)
      throw new Error('El runtime compilado finalizo antes de responder.');
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      break;
    } catch {
      await setTimeout(100);
    }
  }
  assert.ok(response, 'La API compilada no respondio dentro del timeout.');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  console.log(
    'Runtime ESM compilado: GET /api/health correcto sin PostgreSQL.',
  );
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
}
