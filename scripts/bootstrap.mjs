import { copyFileSync, existsSync } from 'node:fs';

const pairs = [
  ['.env.example', '.env'],
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
];

let created = 0;

for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    console.log(`skip   ${to} (no ${from})`);
    continue;
  }

  if (existsSync(to)) {
    console.log(`skip   ${to} (already exists)`);
    continue;
  }

  copyFileSync(from, to);
  console.log(`create ${to}`);
  created += 1;
}

console.log(created ? `\n${created} env file(s) created` : '\nnothing to create');
