#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const targetVersion = process.argv[2]?.trim().replace(/^[vV]/, '');
if (!targetVersion || !/^\d+\.\d+(?:\.\d+)?(?:[-_][0-9A-Za-z.-]+)?$/.test(targetVersion)) {
  console.error('Usage: node scripts/bumpVersion.mjs <new-version> (e.g. 1.0.4)');
  process.exit(1);
}

console.log(`Bumping Pulse version to: ${targetVersion}`);

// 1. Root package.json
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
pkg.version = targetVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✓ Updated package.json (${oldVersion} -> ${targetVersion})`);

// 2. src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = targetVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated src-tauri/tauri.conf.json (${oldVersion} -> ${targetVersion})`);
}

// 3. src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(
    /(\[package\][\s\S]*?version\s*=\s*)"[^"]+"/,
    `$1"${targetVersion}"`,
  );
  fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
  console.log(`✓ Updated src-tauri/Cargo.toml (version = "${targetVersion}")`);
}

// 4. packages/plugin-sdk/package.json
const sdkPkgPath = path.join(rootDir, 'packages', 'plugin-sdk', 'package.json');
if (fs.existsSync(sdkPkgPath)) {
  const sdkPkg = JSON.parse(fs.readFileSync(sdkPkgPath, 'utf8'));
  sdkPkg.version = targetVersion;
  fs.writeFileSync(sdkPkgPath, JSON.stringify(sdkPkg, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated packages/plugin-sdk/package.json`);
}

console.log(`\nAll configuration files synchronized to version ${targetVersion}!`);
console.log(`You can now run "npm run desktop:build" or commit and tag "v${targetVersion}".`);
