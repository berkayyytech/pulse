#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { generatePluginFiles } from './index.ts';

const rawArg = process.argv[2]?.trim() ?? 'my-pulse-plugin';
const safeDir = rawArg.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
const targetDir = path.resolve(process.cwd(), safeDir);

const files = generatePluginFiles({
  id: `community.${safeDir}`,
  name: rawArg,
  author: 'Plugin Developer',
});

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.join(targetDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
}

console.log(`Scaffolded Pulse plugin "${rawArg}" at ${targetDir}`);
