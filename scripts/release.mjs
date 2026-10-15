// What Cloudflare runs after it builds the game from GitHub (Workers Builds, "Deploy command").
// Each Worker says which copy it is with the build variable CLOUDFLARE_ENV: staging or production.
//   1. Adds any new tables or columns from migrations/ to that copy's database.
//   2. Uploads the game.
// If step 1 fails, step 2 never runs, so the game is never live on an old database.
// The build's API token needs "Account, D1, Edit" for step 1 (README, "Going live").
import { execSync } from 'node:child_process';

const env = process.env.CLOUDFLARE_ENV;
if (env !== 'staging' && env !== 'production') {
  console.error('CLOUDFLARE_ENV must be "staging" or "production". Set it in the Worker\'s build variables.');
  process.exit(1);
}

const run = (cmd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run(`npx wrangler d1 migrations apply DB --remote --env ${env} --config wrangler.jsonc`);
run('npx wrangler deploy');
