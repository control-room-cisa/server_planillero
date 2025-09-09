// tests/globalSetup.ts
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

const SHELL = process.platform === 'win32'
  ? process.env.ComSpec || 'cmd.exe'
  : '/bin/sh';

function run(cmd: string) {
  try {
    execSync(cmd, {
      stdio: 'inherit',
      env: process.env as any,
      shell: SHELL, // <- string, no boolean
    });
  } catch (e: any) {
    // Si stdio no es 'inherit', podrías mostrar buffers aquí:
    if (e?.stdout) console.error(String(e.stdout));
    if (e?.stderr) console.error(String(e.stderr));
    throw e;
  }
}

export default async function globalSetup() {
  // Allow fully skipping any DB prep when RUN_DB_TESTS != '1'
  if (process.env.RUN_DB_TESTS !== '1') {
    console.log('RUN_DB_TESTS!=1 -> skipping Prisma setup entirely.');
    return;
  }
  // Load .env.test if present; fallback to .env
  const root = process.cwd();
  const envTest = path.join(root, '.env.test');
  const envDefault = path.join(root, '.env');

  if (fs.existsSync(envTest)) {
    dotenv.config({ path: envTest });
    process.env.NODE_ENV ||= 'test';
    console.log('Loaded .env.test');
  } else if (fs.existsSync(envDefault)) {
    dotenv.config({ path: envDefault });
    process.env.NODE_ENV ||= 'test';
    console.log('Loaded .env');
  }

  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Create .env.test and set a valid MySQL URL. Skipping DB prep.');
    return;
  }

  // Prepare database schema and seed
  try {
    run('npx prisma generate');
  } catch (e) {
    console.error('prisma generate failed. Did you run npm install?', e);
    throw e;
  }

  // Allow skipping heavy reset via env
  const resetFlag = process.env.TEST_DB_RESET !== '0';
  if (resetFlag) {
    try {
      run('npx prisma db push --force-reset');
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (msg.includes('Unknown database') || msg.includes("Can't reach database") || msg.includes('P1003')) {
        console.error('\nCannot connect to test database. Ensure the database in DATABASE_URL exists and MySQL is running.');
        try {
          const dbUrl = process.env.DATABASE_URL as string;
          const u = new URL(dbUrl);
          const dbName = decodeURIComponent(u.pathname.replace(/^\//, ''));
          console.error(`Example: CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4;`);
        } catch {
          console.error('Example: CREATE DATABASE `planillero_test` CHARACTER SET utf8mb4;');
        }
      }
      throw e;
    }
  }

  // Seeding: disabled by default to avoid failures in CI/local without DB fixtures.
  // Opt-in by setting RUN_DB_SEED=1
  if (process.env.RUN_DB_SEED === '1') {
    try {
      run('npx prisma db seed');
    } catch (e) {
      console.error('prisma db seed failed. Set RUN_DB_SEED=1 only if your seed succeeds locally.');
      throw e;
    }
  } else {
    console.log('Skipping prisma db seed (set RUN_DB_SEED=1 to enable).');
  }
}
