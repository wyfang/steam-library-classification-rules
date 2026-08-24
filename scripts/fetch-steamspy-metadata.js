#!/usr/bin/env node

/**
 * Fetch public fallback metadata for AppIDs missing from Steam's local cache.
 * SteamSpy asks clients to keep appdetails requests at one request per second.
 */

const fs = require('fs');

const LOCAL_METADATA = '/private/tmp/steam-all-candidate-metadata.json';
const CANDIDATE_IDS = '/private/tmp/steam-all-candidate-appids.txt';
const PARENT_IDS = '/private/tmp/steam-parent-appids.txt';
const OUTPUT = '/private/tmp/steamspy-fallback-metadata.json';
const DELAY_MS = 1100;

const local = JSON.parse(fs.readFileSync(LOCAL_METADATA, 'utf8'));
const localIds = new Set(local.map(app => Number(app.appid)));
const requestedIds = new Set();

for (const file of [CANDIDATE_IDS, PARENT_IDS]) {
  if (!fs.existsSync(file)) continue;
  for (const value of fs.readFileSync(file, 'utf8').split(/\s+/).filter(Boolean)) {
    const id = Number(value);
    if (id && !localIds.has(id)) requestedIds.add(id);
  }
}

let output = [];
if (fs.existsSync(OUTPUT)) {
  try { output = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')); } catch (_) {}
}
const completed = new Set(output.map(app => Number(app.appid)));
const pending = [...requestedIds].filter(id => !completed.has(id)).sort((a, b) => a - b);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log(`需查询 ${requestedIds.size} 项，已有 ${completed.size} 项缓存，本次 ${pending.length} 项。`);
  for (let index = 0; index < pending.length; index++) {
    const appid = pending[index];
    let record = { appid, name: '', tags: {}, genre: '', source: 'steamspy', unavailable: true };
    try {
      const response = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`);
      const data = await response.json();
      if (data && Number(data.appid) === appid) {
        record = {
          appid,
          name: data.name || '',
          developer: data.developer || '',
          publisher: data.publisher || '',
          genre: data.genre || '',
          tags: data.tags || {},
          source: 'steamspy',
          unavailable: !data.name
        };
      }
    } catch (error) {
      record.error = String(error?.message || error);
    }
    output.push(record);
    fs.writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`);
    if ((index + 1) % 25 === 0 || index + 1 === pending.length) {
      console.log(`进度 ${index + 1}/${pending.length}，已识别 ${output.filter(app => app.name).length} 项。`);
    }
    if (index + 1 < pending.length) await sleep(DELAY_MS);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
