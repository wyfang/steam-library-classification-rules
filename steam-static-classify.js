#!/usr/bin/env node

/**
 * Build a fully static Steam collection plan from the locally extracted
 * inventory. Preview is the default; pass --apply only after Steam exits.
 */

const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.STEAM_ACCOUNT_ID || '89582913';
const STEAM_ROOT = process.env.STEAM_ROOT || '/Users/wangyifang.com/Library/Application Support/Steam';
const INVENTORY_PATH = process.env.STEAM_INVENTORY_PATH || '/private/tmp/steam-all-overviews.json';
const CLOUD_PATH = `${STEAM_ROOT}/userdata/${ACCOUNT_ID}/config/cloudstorage/cloud-storage-namespace-1.json`;
const MODIFIED_PATH = `${STEAM_ROOT}/userdata/${ACCOUNT_ID}/config/cloudstorage/cloud-storage-namespace-1.modified.json`;
const PLAN_PATH = process.env.STEAM_PLAN_PATH || '/private/tmp/steam-static-classification-plan.json';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function tagsOf(app) {
  return new Set((app.store_tags || []).map(Number));
}

function has(app, ...ids) {
  const tags = tagsOf(app);
  return ids.some(id => tags.has(id));
}

function hasAll(app, ...groups) {
  return groups.every(group => has(app, ...group));
}

function namedTagsOf(app) {
  return new Set();
}

function hasNamed(app, ...names) {
  const tags = namedTagsOf(app);
  return names.some(name => tags.has(name.toLowerCase()));
}

function genreContains(app, ...names) {
  return false;
}

function nameMatches(app, pattern) {
  return pattern.test(String(app.name || ''));
}

function idIs(app, ...ids) {
  return ids.includes(Number(app.appid));
}

function genresOf(app) {
  return new Set();
}

function hasGenre(app, ...ids) {
  const genres = genresOf(app);
  return ids.some(id => genres.has(id));
}

function hasCategory(app, ...ids) {
  const categories = new Set((app.store_categories || []).map(Number));
  return ids.some(id => categories.has(id));
}

function text(app) {
  return app.name || '';
}

function existingCollectionIds(cloud, name) {
  for (const pair of cloud) {
    const record = pair?.[1];
    if (!record || record.is_deleted || !record.value) continue;
    try {
      const value = JSON.parse(record.value);
      if (value.name === name) return (value.added || []).map(Number);
    } catch (_) {}
  }
  return [];
}

const overviewTypeNames = new Map([
  [1, 'game'],
  [2, 'application'],
  [4, 'tool'],
  [8, 'demo'],
  [2048, 'video'],
  [8192, 'soundtrack'],
  [65536, 'beta']
]);
const apps = readJson(INVENTORY_PATH).map(overview => ({
  appid: Number(overview.appid),
  name: overview.display_name || `App ${overview.appid}`,
  type: overviewTypeNames.get(Number(overview.app_type)) || 'unknown',
  app_type: Number(overview.app_type),
  store_tags: overview.m_setStoreTags || [],
  store_categories: overview.m_setStoreCategories || [],
  common: {
    review_score: Number(overview.review_score_without_bombs || overview.review_score_with_bombs || 0),
    review_percentage: Number(overview.review_percentage_without_bombs || overview.review_percentage_with_bombs || 0),
    controller_support: Number(overview.xbox_controller_support || 0) >= 2 ? 'full' : '',
    vr_support: Boolean(overview.vr_supported || overview.vr_only)
  },
  overview
}));
const candidates = new Set(apps.map(app => Number(app.appid)));
const cloud = readJson(CLOUD_PATH);
const appById = new Map(apps.map(app => [Number(app.appid), app]));

const playableTypes = new Set(['game', 'demo', 'beta']);
const candidateApps = apps;
const playable = candidateApps.filter(app => playableTypes.has(String(app.type || '').toLowerCase()));
const formalGames = playable.filter(app => app.type === 'game');
const nonGames = candidateApps.filter(app => !playableTypes.has(String(app.type || '').toLowerCase()));
const missingMetadataIds = [...candidates].filter(id => !appById.has(id)).sort((a, b) => a - b);

const aaaIds = new Set([
  3768760, 933110, 1172470, 107410, 668580, 924970, 1086940, 2807960,
  7670, 409720, 8870, 2358720, 1938090, 730, 1091500, 374320, 1422450,
  3280350, 1222140, 2344520, 435150, 570, 239140, 1245620, 22370, 1151340,
  1293830, 1551360, 2483190, 12230, 1546970, 12210, 3240220, 271590, 12250,
  1547000, 12240, 1546990, 70, 220, 546560, 976730, 1817230, 1659040,
  236870, 863550, 2456740, 1244460, 1041720, 550, 532210, 1501750,
  1030840, 1222680, 1328660, 1846380, 2357570, 1272080, 400, 620,
  578080, 3764200, 1174180, 391220, 750920, 8930, 289070, 1716740,
  646910, 72850, 1920490, 292030, 359550, 203160
]);

const demoPattern = /(?:\bdemo\b|\bbeta\b|\bplaytest\b|\bprologue\b|test server|testing grounds|final test|network test|friend'?s pass|creative studio|teaser|测试版|试玩版|试玩)/iu;
const adultPattern = /(?:hentai|sexual|nsfw|adult only|nudity|色情|成人内容)/iu;
const legacyChineseIds = new Set(existingCollectionIds(cloud, '国产大作'));

const rules = [
  ['uc-HotAAA3A2026', '热门3A大作', app => aaaIds.has(Number(app.appid)), true],
  ['from-tag-国产大作', '国产大作', app => legacyChineseIds.has(Number(app.appid)), true],
  ['uc-ai-static-indie', '独立游戏', app => has(app, 492) || hasGenre(app, 23) || hasNamed(app, 'Indie') || genreContains(app, 'Indie')],
  ['uc-ai-static-indie-gems', '独立佳作', app => (has(app, 492) || hasGenre(app, 23)) && Number(app.common?.review_score || 0) >= 8 && Number(app.common?.review_percentage || 0) >= 90],
  ['uc-ai-static-overwhelming', '好评如潮', app => Number(app.common?.review_score || 0) === 9],

  ['uc-ai-static-action', '动作', app => has(app, 19) || hasGenre(app, 1) || hasNamed(app, 'Action') || genreContains(app, 'Action') || nameMatches(app, /(?:battle|combat|brawl|fighter|warrior|ninja|gun|shooter|kill|slayer|sword|hunter|revenge)/iu) || idIs(app, 12240, 17770, 47830)],
  ['uc-ai-static-action-adventure', '动作冒险', app => has(app, 4106) || hasNamed(app, 'Action-Adventure') || idIs(app, 12240)],
  ['uc-ai-static-action-rpg', '动作RPG', app => has(app, 4231) || hasNamed(app, 'Action RPG')],
  ['uc-ai-static-hack-slash', '砍杀', app => has(app, 1646) || hasNamed(app, 'Hack and Slash')],
  ['uc-ai-static-souls', '类魂', app => has(app, 29482) || hasNamed(app, 'Souls-like')],
  ['uc-ai-static-fighting', '格斗', app => has(app, 1743, 4736, 6506) || hasNamed(app, 'Fighting', '2D Fighter', '3D Fighter')],
  ['uc-ai-static-platformer', '平台跳跃', app => has(app, 1625, 5379, 5395, 3877, 5537) || hasNamed(app, 'Platformer', '2D Platformer', '3D Platformer')],
  ['uc-ai-static-metroidvania', '类银河战士恶魔城', app => has(app, 1628) || hasNamed(app, 'Metroidvania')],
  ['uc-ai-static-shooter', '射击游戏', app => has(app, 1774, 1663, 3814, 4637, 4758) || hasNamed(app, 'Shooter', 'FPS', 'Third-Person Shooter', 'Twin Stick Shooter') || idIs(app, 17770, 47830)],
  ['uc-ai-static-fps', '第一人称射击', app => has(app, 1663) || hasNamed(app, 'FPS') || idIs(app, 17770, 47830)],
  ['uc-ai-static-tps', '第三人称射击', app => has(app, 3814) || hasNamed(app, 'Third-Person Shooter')],
  ['uc-ai-static-tactical-shooter', '战术射击', app => hasAll(app, [1708], [1774, 1663, 3814, 4637]) || hasNamed(app, 'Tactical') && hasNamed(app, 'Shooter', 'FPS', 'Third-Person Shooter')],

  ['uc-ai-static-rpg', '角色扮演', app => has(app, 122) || hasGenre(app, 3) || hasNamed(app, 'RPG') || genreContains(app, 'RPG') || nameMatches(app, /(?:\brpg\b|dungeon|mage|wizard|sorcery|fantasy|quest|crusade)/iu)],
  ['uc-ai-static-jrpg', '日式RPG', app => has(app, 4434) || hasNamed(app, 'JRPG')],
  ['uc-ai-static-crpg', '电脑RPG', app => has(app, 4474) || hasNamed(app, 'CRPG')],
  ['uc-ai-static-turn-rpg', '回合制RPG', app => hasAll(app, [122, 4434, 4474], [4325, 1677, 1741, 14139])],
  ['uc-ai-static-mmorpg', '大型多人在线RPG', app => has(app, 1754) || hasGenre(app, 29) || hasNamed(app, 'MMORPG', 'Massively Multiplayer') || genreContains(app, 'Massively Multiplayer')],

  ['uc-ai-static-strategy', '策略', app => has(app, 9) || hasGenre(app, 2) || hasNamed(app, 'Strategy') || genreContains(app, 'Strategy') || nameMatches(app, /(?:tactics|defen[cs]e|commander|war game|chess|kingdom|empire|warfare)/iu) || idIs(app, 236330)],
  ['uc-ai-static-turn-strategy', '回合制策略', app => has(app, 1741, 14139) || hasNamed(app, 'Turn-Based Strategy', 'Turn-Based Tactics')],
  ['uc-ai-static-rts', '即时战略', app => has(app, 1676, 1723) || hasNamed(app, 'RTS', 'Real Time Tactics')],
  ['uc-ai-static-grand-strategy', '4X与大战略', app => has(app, 1670, 4364) || hasNamed(app, '4X', 'Grand Strategy')],
  ['uc-ai-static-tower-defense', '塔防', app => has(app, 1645) || hasNamed(app, 'Tower Defense')],
  ['uc-ai-static-cards', '卡牌与牌组构建', app => has(app, 1666, 32322, 791774, 1091588, 9271) || hasNamed(app, 'Card Game', 'Deckbuilding', 'Deckbuilding Roguelike')],

  ['uc-ai-static-simulation', '模拟', app => has(app, 599) || hasGenre(app, 28) || hasNamed(app, 'Simulation') || genreContains(app, 'Simulation') || nameMatches(app, /(?:simulator|tycoon|farming|factory|restaurant|shop|renovator|entrepreneur)/iu)],
  ['uc-ai-static-building-management', '建造与经营', app => has(app, 1643, 12472, 4328, 7332, 8945, 220585) || hasNamed(app, 'Management', 'Building', 'Economy')],
  ['uc-ai-static-city-builder', '城市营造', app => has(app, 4328) || hasNamed(app, 'City Builder')],
  ['uc-ai-static-automation-base', '自动化与基地建设', app => has(app, 255534, 7332) || hasNamed(app, 'Automation', 'Base Building')],
  ['uc-ai-static-survival-crafting', '生存与制作', app => has(app, 1662, 1702, 1100689) || hasNamed(app, 'Survival', 'Crafting', 'Open World Survival Craft')],
  ['uc-ai-static-farming-life', '农场与生活模拟', app => has(app, 87918, 4520, 10235) || hasNamed(app, 'Farming Sim', 'Life Sim')],
  ['uc-ai-static-racing', '竞速', app => has(app, 699, 4102) || hasGenre(app, 9) || hasNamed(app, 'Racing') || genreContains(app, 'Racing') || nameMatches(app, /(?:racing|drift|wingsuit|skater|parking)/iu)],
  ['uc-ai-static-sports', '体育', app => has(app, 701) || hasGenre(app, 18) || hasNamed(app, 'Sports') || genreContains(app, 'Sports') || nameMatches(app, /(?:football|wrestl|sporting|skater)/iu)],

  ['uc-ai-static-adventure', '冒险', app => has(app, 21) || hasGenre(app, 25) || hasNamed(app, 'Adventure') || genreContains(app, 'Adventure') || nameMatches(app, /(?:adventure|journey|tales? of|mystery|pilgrim|destiny)/iu) || idIs(app, 12240)],
  ['uc-ai-static-story-rich', '剧情丰富', app => has(app, 1742, 7702) || hasNamed(app, 'Story Rich', 'Narrative')],
  ['uc-ai-static-puzzle', '解谜', app => has(app, 1664) || hasNamed(app, 'Puzzle') || nameMatches(app, /(?:puzzle|sudoku|escape|maze|logik|logic|pictoglyph)/iu) || Number(app.appid) === 905230],
  ['uc-ai-static-point-click', '点击式冒险', app => has(app, 1698) || hasNamed(app, 'Point & Click')],
  ['uc-ai-static-visual-novel', '视觉小说', app => has(app, 3799) || hasNamed(app, 'Visual Novel') || nameMatches(app, /(?:visual novel|dating sim)/iu)],
  ['uc-ai-static-horror', '恐怖', app => has(app, 1667, 1721, 3978) || hasNamed(app, 'Horror', 'Psychological Horror', 'Survival Horror') || nameMatches(app, /(?:horror|fear|ghost|backrooms|agony|nightmare)/iu)],
  ['uc-ai-static-stealth', '潜行', app => has(app, 1687) || hasNamed(app, 'Stealth')],
  ['uc-ai-static-sandbox', '沙盒', app => has(app, 3810) || hasNamed(app, 'Sandbox')],
  ['uc-ai-static-open-world', '开放世界', app => has(app, 1695) || hasNamed(app, 'Open World') || idIs(app, 12240)],
  ['uc-ai-static-rogue', 'Roguelike与Roguelite', app => has(app, 1716, 3959, 42804, 454187) || hasNamed(app, 'Roguelike', 'Roguelite', 'Action Roguelike')],
  ['uc-ai-static-rhythm', '节奏与音乐', app => has(app, 1752, 1621) || hasNamed(app, 'Rhythm', 'Music')],
  ['uc-ai-static-party', '聚会游戏', app => has(app, 7108, 7178) || hasNamed(app, 'Party Game', 'Party')],
  ['uc-ai-static-idle', '增量与挂机', app => has(app, 560542, 615955) || hasNamed(app, 'Idler', 'Incremental')],
  ['uc-ai-static-casual', '休闲游戏', app => has(app, 597) || hasGenre(app, 4) || hasNamed(app, 'Casual') || genreContains(app, 'Casual') || idIs(app, 236330)],
  ['uc-ai-static-typing', '打字与教育', app => has(app, 1674, 1036)],
  ['uc-ai-static-anime', '动漫', app => has(app, 4085) || hasNamed(app, 'Anime')],
  ['uc-ai-static-adult', '成人向', app => adultPattern.test(text(app)) || has(app, 12095, 6650, 9130, 5611) || hasNamed(app, 'Hentai', 'NSFW', 'Sexual Content', 'Nudity')],

  ['uc-ai-static-singleplayer', '单人游戏', app => has(app, 4182) || hasCategory(app, 2) || hasNamed(app, 'Singleplayer') || idIs(app, 12240, 236330)],
  ['uc-ai-static-multiplayer', '多人游戏', app => has(app, 3859, 128) || hasCategory(app, 1) || hasNamed(app, 'Multiplayer', 'Massively Multiplayer') || idIs(app, 17770, 47830)],
  ['uc-ai-static-online-coop', '在线合作', app => has(app, 3843, 1685, 4508) || hasCategory(app, 9, 38) || hasNamed(app, 'Online Co-Op', 'Co-op')],
  ['uc-ai-static-local', '本地合作与同屏', app => has(app, 3841, 7368, 10816) || hasCategory(app, 24, 39) || hasNamed(app, 'Local Co-Op', 'Local Multiplayer', 'Split Screen')],
  ['uc-ai-static-pvp', 'PvP竞技', app => has(app, 1775, 3878, 5055) || hasCategory(app, 36, 37, 49) || hasNamed(app, 'PvP')],
  ['uc-ai-static-early-access', '抢先体验', app => has(app, 493) || hasGenre(app, 70) || hasNamed(app, 'Early Access')],
  ['uc-ai-static-vr', 'VR游戏', app => has(app, 21978) || Boolean(app.common?.vr_support) || hasNamed(app, 'VR')],
  ['uc-ai-static-controller', '完全支持手柄', app => app.common?.controller_support === 'full' || hasCategory(app, 28)],
  ['uc-ai-static-mac', 'Mac可玩', app => String(app.common?.oslist || '').split(',').includes('macos')],
  ['uc-ai-static-demo-test', '试玩版与测试版', app => app.type === 'demo' || app.type === 'beta' || demoPattern.test(app.name || ''), true]
];

const genreRuleIds = new Set(rules.slice(5, 54).map(rule => rule[0]));
let collections = rules.map(([id, name, match, keep = false]) => ({
  id,
  name,
  keep,
  appids: playable.filter(match).map(app => Number(app.appid)).sort((a, b) => a - b)
}));

const chinese = collections.find(collection => collection.name === '国产大作');
chinese.appids = [...legacyChineseIds].filter(id => candidates.has(id)).sort((a, b) => a - b);

const coveredByGenre = new Set(
  collections.filter(collection => genreRuleIds.has(collection.id)).flatMap(collection => collection.appids)
);
const unclassifiedPlayableIds = formalGames
  .map(app => Number(app.appid))
  .filter(id => !coveredByGenre.has(id))
  .sort((a, b) => a - b);
const demosWithoutGameplay = playable
  .filter(app => app.type === 'demo' || app.type === 'beta')
  .map(app => Number(app.appid))
  .filter(id => !coveredByGenre.has(id))
  .sort((a, b) => a - b);

collections.push({
  id: 'uc-ai-static-other',
  name: '其他与未标注',
  keep: unclassifiedPlayableIds.length > 0,
  appids: unclassifiedPlayableIds
});
collections.push({
  id: 'uc-ai-static-non-game',
  name: '非游戏内容与工具',
  keep: true,
  appids: nonGames.map(app => Number(app.appid)).sort((a, b) => a - b)
});
collections.push({
  id: 'uc-ai-static-soundtracks',
  name: '原声音轨（静态）',
  keep: true,
  appids: candidateApps.filter(app => app.type === 'soundtrack').map(app => Number(app.appid)).sort((a, b) => a - b)
});
collections.push({
  id: 'uc-ai-static-software',
  name: '软件与应用',
  keep: true,
  appids: candidateApps.filter(app => app.type === 'application').map(app => Number(app.appid)).sort((a, b) => a - b)
});
collections.push({
  id: 'uc-ai-static-tools',
  name: '工具与专用服务器',
  keep: true,
  appids: candidateApps.filter(app => app.type === 'tool').map(app => Number(app.appid)).sort((a, b) => a - b)
});
collections.push({
  id: 'uc-ai-static-videos',
  name: '视频内容',
  keep: true,
  appids: candidateApps.filter(app => app.type === 'video').map(app => Number(app.appid)).sort((a, b) => a - b)
});
collections.push({
  id: 'uc-ai-static-unknown',
  name: '待识别AppID',
  keep: true,
  appids: missingMetadataIds
});

collections = collections.filter(
  collection => collection.appids.length > 0 && (collection.keep || collection.appids.length >= 3)
);

const plan = {
  generated_at: new Date().toISOString(),
  mode: 'fully-static',
  source: 'running-steam-app-overviews',
  candidate_appids: candidates.size,
  metadata_entries: apps.length,
  formal_games: formalGames.length,
  demos: playable.filter(app => app.type === 'demo').length,
  betas: playable.filter(app => app.type === 'beta').length,
  non_games: nonGames.length,
  missing_metadata: missingMetadataIds.length,
  unclassified_playable: unclassifiedPlayableIds.length,
  demos_without_gameplay: demosWithoutGameplay.length,
  collections: collections.map(collection => ({
    id: collection.id,
    name: collection.name,
    count: collection.appids.length,
    dynamic: false,
    appids: collection.appids,
    games: collection.appids.map(id => appById.get(id)?.name || `App ${id}`)
  }))
};

fs.writeFileSync(PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);

for (const collection of plan.collections) {
  process.stdout.write(`${String(collection.count).padStart(5)}  静态  ${collection.name}\n`);
}
process.stdout.write(`\n候选 ${plan.candidate_appids}，正式游戏 ${plan.formal_games}，Demo ${plan.demos}，Beta ${plan.betas}，非游戏 ${plan.non_games}，缺少元数据 ${plan.missing_metadata}。\n`);
process.stdout.write(`正式游戏玩法未标注 ${plan.unclassified_playable}，Demo/Beta仅有状态分类 ${plan.demos_without_gameplay}，共 ${plan.collections.length} 个全静态收藏。\n`);
process.stdout.write(`预览已写入 ${PLAN_PATH}\n`);

if (!process.argv.includes('--apply')) process.exit(0);

const now = Math.floor(Date.now() / 1000);
const generatedKeys = new Set(plan.collections.map(collection => `user-collections.${collection.id}`));

function isScriptCollectionKey(key) {
  return key.startsWith('user-collections.uc-ai-v2-') ||
    key.startsWith('user-collections.uc-ai-static-');
}

// Steam Cloud synchronizes this namespace by key. Removing a key only from the
// local array does not delete its cloud copy, so another computer can restore
// the old collection. Superseded script collections must remain as explicit
// deletion records until Steam has uploaded them.
const deletedEntries = cloud
  .filter(pair => {
    const key = pair?.[0] || '';
    const record = pair?.[1];
    return record && !record.is_deleted && isScriptCollectionKey(key) && !generatedKeys.has(key);
  })
  .map(pair => {
    const key = pair[0];
    return [key, {
      key,
      timestamp: now,
      is_deleted: true,
      version: String(now)
    }];
  });

const kept = cloud.filter(pair => {
  const key = pair?.[0] || '';
  const record = pair?.[1];
  if (generatedKeys.has(key)) return false;
  if (record?.is_deleted) return true;
  return !isScriptCollectionKey(key);
});

const newEntries = plan.collections.map(collection => {
  const key = `user-collections.${collection.id}`;
  return [key, {
    key,
    timestamp: now,
    version: String(now),
    value: JSON.stringify({
      id: collection.id,
      name: collection.name,
      added: collection.appids,
      removed: [],
      filterSpec: {}
    })
  }];
});

const output = [...kept, ...deletedEntries, ...newEntries];
const modified = fs.existsSync(MODIFIED_PATH) ? readJson(MODIFIED_PATH) : [];
const modifiedKeys = [...new Set([
  ...modified,
  ...deletedEntries.map(pair => pair[0]),
  ...newEntries.map(pair => pair[0])
])];

const cloudTemp = `${CLOUD_PATH}.static-classify.tmp`;
const modifiedTemp = `${MODIFIED_PATH}.static-classify.tmp`;
fs.writeFileSync(cloudTemp, JSON.stringify(output));
fs.writeFileSync(modifiedTemp, JSON.stringify(modifiedKeys));
fs.renameSync(cloudTemp, CLOUD_PATH);
fs.renameSync(modifiedTemp, MODIFIED_PATH);
process.stdout.write(`已写入全静态收藏配置，并为 ${deletedEntries.length} 个旧收藏写入删除记录。\n`);
