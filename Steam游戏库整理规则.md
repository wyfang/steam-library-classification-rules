# Steam 游戏库整理规则与复用手册

最后更新：2026-08-22

这份文档用于下次继续整理 `wyfang` 的 Steam 游戏库。应先读本文，再检查现有脚本；不要重新扫描整个 Steam 目录，也不要把当前轻量缓存误认为两万多款应用的完整明细。

## 1. 账号与目标

| 项目 | 值 |
| --- | --- |
| macOS 用户目录 | `/Users/wangyifang.com` |
| Steam 账号 | `wyfang` |
| AccountID | `89582913` |
| SteamID64 | `76561198049848641` |
| 分类原则 | 以 Steam 商店标签和业内常规划分为主，允许一款游戏同时属于多个收藏 |

用户的特殊要求：

- `热门3A大作`：只放知名、热门的 AAA 或同等规模作品，采用人工 AppID 白名单。
- `国产大作`：名称带有反讽含义，只放中国来源、页游化、低质移植或强商业化作品。精品国产游戏和精品海外游戏不得放入。
- 不建立 `免费开玩` 总分类。免费游戏必须按动作、RPG、策略、多人、合作等具体玩法分类。
- `试玩版与测试版` 只保留名称明确含 Demo、Beta、Playtest、Prologue、测试版、试玩版等字样的条目；禁止重新使用“应用类型 = Demo”的全库动态规则。
- 分类应尽量细，但避免没有实际浏览价值的巨大总分类。
- 不删除游戏、不改变授权、不扫描安装目录，只整理收藏关系。

## 2. 读取和安全限制

必须遵守：

- 禁止读取或反复解析约 82 MB 的 `appinfo.vdf`，除非用户以后明确撤销该限制。
- 禁止扫描 Steam 游戏安装目录。
- 只读取收藏配置、现有轻量缓存和分类脚本；当前一次运行的正常读取量应低于约 1 MB。
- 修改前让用户完全退出 Steam，包括菜单栏中的 Steam。Steam 运行时可能覆盖刚写入的收藏文件。
- 写入前必须备份 `cloud-storage-namespace-1.json` 和对应的 `.modified.json`。
- 保留收藏夹、已隐藏和所有不属于本脚本的 Steam 数据。
- 不要删除、重置或覆盖整个 `userdata` 目录。

重要：现有脚本依赖 `/private/tmp` 中的缓存和初始备份。临时目录内容可能在清理或重启后消失。运行前必须确认所有依赖文件存在；尤其是初始备份缺失时，不得直接执行 `--apply`，否则 `国产大作` 中未缓存的历史 AppID 可能丢失。

## 3. 关键文件

| 用途 | 路径 |
| --- | --- |
| 分类脚本，规则的权威来源 | `/Users/wangyifang.com/steam-classify.js` |
| 轻量游戏元数据缓存 | `/private/tmp/steam-library-inventory.json` |
| Steam 中文标签对照 | `/private/tmp/steam-tags-zh.json` |
| 最近生成的分类计划 | `/private/tmp/steam-classification-plan.json` |
| 当前收藏配置 | `/Users/wangyifang.com/Library/Application Support/Steam/userdata/89582913/config/cloudstorage/cloud-storage-namespace-1.json` |
| 待同步键列表 | `/Users/wangyifang.com/Library/Application Support/Steam/userdata/89582913/config/cloudstorage/cloud-storage-namespace-1.modified.json` |
| 整理前初始备份 | `/private/tmp/steam-collection-backup-full.5nFZyP/cloud-storage-namespace-1.json` |
| 最近一次可回退备份 | `/private/tmp/steam-collection-backup-remove-free.SZXLf3` |

当前轻量缓存大小约 484 KB，只包含 637 款有明文元数据的游戏。它用于生成静态条目和预览，不代表账号全部两万多款游戏、Demo 和测试授权。

## 4. 分类实现原理

Steam 收藏配置保存在 `cloud-storage-namespace-1.json`。文件最外层是键值条目数组，收藏键类似：

```text
user-collections.uc-ai-v2-action
```

每个收藏的 `value` 又是一段 JSON 字符串，核心字段为：

```json
{
  "id": "uc-ai-v2-action",
  "name": "动作",
  "added": [],
  "removed": [],
  "filterSpec": {}
}
```

分类分为两类：

- 动态收藏：包含 Steam 原生 `filterSpec`。客户端依据完整库中的商店标签自动显示匹配游戏，因此实际显示数量可能远大于 637 款本地缓存。
- 静态收藏：只依赖明确的 AppID 列表，适合人工精选、特殊例外和没有可靠动态规则的项目。

动态过滤组已经确认：

| 过滤组 | 含义 |
| --- | --- |
| `0` | 应用类型 |
| `1` | 游玩状态或当前平台 |
| `2` | Steam 功能，例如单人、多人、手柄、VR |
| `4` | Steam 商店标签 |

同组 `bAcceptUnion: true` 表示匹配任一标签；`false` 表示必须同时满足该组中的选项。商店标签的精确数字映射以脚本中的 `specs` 和 `dynamicRules` 为准，修改分类时通常要同步修改这两处。

## 5. 当前分类规则

### 静态或人工判断类

| 分类 | 当前缓存/静态数量 | 规则 |
| --- | ---: | --- |
| 热门3A大作 | 74 | 脚本中的 `aaaIds` 人工白名单 |
| 国产大作 | 1224 | `chineseJunkIds` 加初始备份中无法识别但需暂时保留的历史条目 |
| 独立佳作 | 112 | 独立标签，评价档位不低于 8，且好评率不低于 90% |
| 好评如潮 | 78 | 本地评价档位为 9 |
| 试玩版与测试版 | 15 | 仅名称正则匹配，静态收藏，不含 `filterSpec` |
| 其他与未标注 | 4 | 637 款缓存中没有进入具体玩法分类的兜底条目 |

已知的四个本地兜底条目是：`Grand Theft Auto: Vice City`、`Savage 2: A Tortured Soul`、`Firearms: Source` 和 `Laser League Beta`。

### Steam 标签动态分类

当前共 55 个动态收藏，按用途分组如下：

- 综合与评价：独立游戏。
- 动作：动作、动作冒险、动作RPG、砍杀、类魂、格斗、平台跳跃、类银河战士恶魔城。
- 射击：射击游戏、第一人称射击、第三人称射击、战术射击。
- RPG：角色扮演、日式RPG、电脑RPG、回合制RPG、大型多人在线RPG。
- 策略：策略、回合制策略、即时战略、4X与大战略、塔防、卡牌与牌组构建。
- 模拟经营：模拟、建造与经营、城市营造、自动化与基地建设、生存与制作、农场与生活模拟、竞速、体育。
- 冒险与题材：冒险、剧情丰富、解谜、点击式冒险、视觉小说、恐怖、潜行、沙盒、开放世界、Roguelike与Roguelite、节奏与音乐、休闲与派对、动漫、成人向。
- 游玩方式与功能：单人游戏、多人游戏、在线合作、本地合作与同屏、PvP竞技、抢先体验、VR游戏、完全支持手柄、Mac可玩。

`Roguelike与Roguelite` 匹配四个 Steam 标签：类 Rogue、轻度 Rogue、动作类 Rogue、传统类 Rogue。此类游戏通常有随机生成、反复开局和死亡重置；Roguelite 一般还保留永久成长。

### 免费游戏处理

- `免费开玩` 收藏已删除，脚本中也不再生成该收藏。
- 禁止把 Steam 标签 `113` 单独作为收藏条件。
- 当前缓存中识别出的 205 款免费游戏已经 205/205 至少进入一个具体玩法分类。
- `IQ Test`（AppID `905230`）因只有免费标签，人工补入 `解谜`。
- 增量、挂机和打字标签目前归入 `休闲与派对`，用于保证缺少其他玩法标签的免费游戏不落入未分类。

### 试玩版与测试版处理

- 当前使用名称正则：Demo、Beta、Playtest、Prologue、Test Server、Teaser、测试版、试玩版、试玩。
- 当前为 15 项静态收藏。
- 严禁恢复以下规则：过滤组 `0`、选项 `[8]`。该规则会把账号中约 2.7 万个 Demo/测试授权全部塞入一个收藏。
- Demo 如果具有动作、RPG、策略等商店标签，仍会自动进入相应动态分类。

### 休闲与派对的待优化项

当前该分类约 263 项，合并了以下标签，因此偏宽：

| 标签 | TagID |
| --- | ---: |
| 休闲 | 597 |
| 社交聚会 | 7108 |
| 社交聚会游戏 | 7178 |
| 增量 | 560542 |
| 挂机游戏 | 615955 |
| 打字 | 1674 |

用户已经反馈这个收藏偏大，但尚未明确要求采用哪种拆法。下次优化时建议拆成 `聚会游戏`、`增量与挂机`、`打字与教育`；宽泛的 `休闲` 标签可以单独保留或直接取消，应先征求用户选择。

## 6. “未分类 593”如何理解

Steam 客户端当前显示约 593 个未分类条目，但脚本的轻量缓存只有 637 款，其中脚本已知的 `其他与未标注` 仅 4 款。

这两个数字并不矛盾：

- 动态收藏会让 Steam 客户端依据完整游戏库自动匹配标签。
- 本地轻量缓存没有完整覆盖两万多款应用。
- 约 593 个未分类条目中，一部分可能是下架游戏、测试服、旧版本、专用服务器、工具或没有商店标签的应用。
- 在当前禁止读取 `appinfo.vdf`、禁止大范围扫描且 Computer Use 不可用的条件下，无法可靠取得其名称和标签。

因此不得宣称“全部两万多款已经逐项分类”。准确表述应为：已建立覆盖常见 Steam 标签的动态收藏，并完成当前 637 款轻量缓存的规则校验；客户端仍有约 593 个无法在当前读取限制下可靠识别的条目。

## 7. 下次执行步骤

### 7.1 前置检查

1. 确认用户仍要操作账号 `wyfang`。
2. 让用户完全退出 Steam。
3. 确认第 3 节中的脚本、637 款缓存、初始备份和当前收藏文件均存在。
4. 使用 `wc -c` 检查文件大小；若出现意外的大文件，停止并说明。
5. 不读取 `appinfo.vdf`，不扫描安装目录。

### 7.2 创建小型备份

```zsh
backup_dir=$(mktemp -d /private/tmp/steam-collection-backup-next.XXXXXX)
cp '/Users/wangyifang.com/Library/Application Support/Steam/userdata/89582913/config/cloudstorage/cloud-storage-namespace-1.json' "$backup_dir/cloud-storage-namespace-1.json"
cp '/Users/wangyifang.com/Library/Application Support/Steam/userdata/89582913/config/cloudstorage/cloud-storage-namespace-1.modified.json' "$backup_dir/cloud-storage-namespace-1.modified.json"
```

记录终端输出的实际备份目录，以便回退。

### 7.3 预览和写入

先只生成计划，不改 Steam：

```zsh
node /Users/wangyifang.com/steam-classify.js
```

检查 `/private/tmp/steam-classification-plan.json` 和终端计数。确认无误后写入：

```zsh
node /Users/wangyifang.com/steam-classify.js --apply
```

脚本会采用临时文件加原子重命名写入，并把新增、更新和删除的收藏键加入 `.modified.json`，让 Steam 云同步知道哪些收藏发生了变化。

### 7.4 必须校验

- 不存在名称或 ID 为 `免费开玩`、`uc-ai-v2-free` 的收藏。
- `试玩版与测试版` 没有 `filterSpec`，数量应约为 15，而不是 2.7 万。
- `热门3A大作` 与 `国产大作` 不交叉。
- 已确认的精品海外游戏和精品国产游戏不在 `国产大作`。
- 收藏夹和已隐藏条目与写入前备份完全相同。
- 脚本生成的 AppID 列表中没有重复值。
- 被删除的旧脚本收藏键也进入 `.modified.json`，防止云端恢复旧收藏。
- 当前基准为 61 个脚本收藏：55 个动态、6 个静态。规则调整后数量可以变化，但必须解释原因。

校验通过后再重新打开 Steam，等待收藏重载和云同步。若 Steam 显示旧数据，应先确认客户端此前是否完全退出，不要立即反复覆盖文件。

## 8. 修改脚本时的注意事项

- `specs` 决定本地预览、静态 `added` 列表及分类名称。
- `dynamicRules` 决定 Steam 客户端针对完整库的动态匹配。
- 修改动态分类时必须同步检查两者，否则本地计数和客户端显示规则会不一致。
- `genreSpecIds` 当前通过 `specs.slice(5, 50)` 选取具体玩法分类，属于位置相关逻辑。插入、删除或调整这一段分类时必须同步检查该范围，否则 `其他与未标注` 计算会出错。
- 少于 3 款的普通细分类默认不创建；`热门3A大作` 和 `国产大作` 不受该限制。
- 收藏允许重叠，这是设计目标。例如一款游戏可同时处于动作、开放世界、单人游戏和热门3A大作。
- `国产大作` 的 1224 项多数来自旧分类中没有明文元数据的历史 AppID。没有可靠证据时保留；只移出能够确认的误分类。
- 如果 `/private/tmp/steam-collection-backup-full.5nFZyP` 不存在，先停止，不要直接重跑脚本。

## 9. 当前结果快照

截至 2026-08-22：

- 脚本收藏：61 个。
- 动态收藏：55 个。
- 静态收藏：6 个。
- 轻量元数据来源：637 款。
- 热门3A大作：74 项。
- 国产大作：1224 项。
- Roguelike与Roguelite：49 项。
- 休闲与派对：263 项，待进一步拆分。
- 试玩版与测试版：15 项。
- 其他与未标注：本地缓存内 4 项。
- Steam 客户端未分类：用户观察约 593 项，当前限制下无法可靠取得完整明细。
- 免费开玩：收藏已取消；缓存内 205 款免费游戏已全部进入至少一个具体玩法分类。

