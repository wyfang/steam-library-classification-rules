# Steam 游戏库整理规则与复用手册

最后更新：2026-08-24

这份文档用于下次继续整理 `wyfang` 的 Steam 游戏库。应先读本文，再检查现有脚本；不要重新扫描整个 Steam 目录，也不要把当前轻量缓存误认为两万多款应用的完整明细。

## 0. 2026-08-24 全静态版本（优先阅读）

本节是当前有效状态，优先于下文保留的旧动态方案说明。

- 当前已写入 **68 个全静态收藏**，所有收藏的 `filterSpec` 都为空，不再依赖 Steam 动态标签过滤。
- 通过 Steam 客户端运行时的完整 `all-apps-alpha` 集合，共取得 **26,834 个唯一 AppID**；这次不再把 3,906 条本机缓存误当作完整游戏库。
- 已识别：**24,011 款正式游戏、190 个 Demo、15 个 Beta/Playtest、2,618 项非游戏内容**。
- 生成收藏的 AppID 并集为 **26,834/26,834**，遗漏 0、额外 0；Steam 客户端最终显示 **`未分类 (0)`** 和“空空如也”。
- `试玩版与测试版` 共 **955 项**，包含 Steam 明确标记的 Demo/Beta/Playtest，以及名称明确包含 Demo、Beta、Playtest、Prologue、测试版、试玩版等字样的游戏；资料足够时也同时进入玩法收藏。
- 免费游戏不建立巨大的 `免费开玩` 总收藏，而是根据 Steam 商店标签直接进入动作、RPG、策略、多人、合作等具体玩法收藏。
- 只有 **58 款正式游戏**缺乏足够的玩法标签，静态进入 `其他与未标注`；它们也不再属于 Steam 的系统“未分类”。
- 非游戏内容细分为：原声音轨 959、软件与应用 752、工具与专用服务器 349、视频内容 558；同时保留 `非游戏内容与工具` 总集合。
- 本次写入前备份：`/private/tmp/steam-classification-before-full.F9alH1/cloud-storage-namespace-1.final-before-apply.json`。
- 跨电脑同步时，旧收藏不能只从本地 JSON 数组中移除；必须写成带 `is_deleted: true` 的删除记录并加入 `.modified.json`。否则云端仍保留旧键，其他电脑登录后会同时显示新旧收藏。当前脚本已修正这一点。

### 0.0.1 2026-08-24 Windows 全量重建与云同步补充

- Windows 从 Steam 运行时重新导出 **26,840 个唯一 AppID**，比 macOS 初次全量整理时新增 6 项；识别为 24,016 款正式游戏、190 个 Demo、15 个 Beta 和 2,619 项非游戏内容。
- 重新生成 68 个全静态收藏后，收藏 AppID 并集为 **26,840/26,840**，遗漏 0、额外 0；Windows 客户端验证为 **`未分类 (0)`** 和“空空如也”。
- 先前 Windows 只覆盖 3,906 个 AppID 的 65 个收藏，是 macOS 整理过程中的中间版本，并非最终全量版本。
- Steam CloudStorage 将 70 个修改键合并成约 1.7 MiB 的单次请求时，服务器返回 `EResult 2`，并进入指数退避；这会让客户端看似“已同步”，但收藏的 `.modified.json` 一直不清空。
- 本次将普通收藏键按每批 5 个上传，对包含超大 AppID 列表的最后 15 个键逐键上传；所有请求均返回成功。普通模式重启后日志显示 namespace 1 为 `598 entries (0 modified)`。
- `steam-static-classify.js` 现可通过 `STEAM_ROOT`、`STEAM_INVENTORY_PATH` 和 `STEAM_PLAN_PATH` 环境变量在 Windows 上复用。以后全量写入后，必须确认 `.modified.json` 最终变成 `[]`；不能只看 Steam 的普通云存档状态。

当前脚本：

| 用途 | 路径 |
| --- | --- |
| 全静态分类与写入 | `/Users/wangyifang.com/Wi-Fi/GitHub/steam-library-classification-rules/steam-static-classify.js` |
| Windows 一键清理旧收藏 | `/Users/wangyifang.com/Wi-Fi/GitHub/steam-library-classification-rules/scripts/remove-legacy-steam-collections.cmd`（调用同目录 `.ps1`） |
| Steam 只读调试读取 | `/Users/wangyifang.com/Wi-Fi/GitHub/steam-library-classification-rules/scripts/steam-cdp-eval.js` |
| 完整运行时元数据导出表达式 | `/Users/wangyifang.com/Wi-Fi/GitHub/steam-library-classification-rules/scripts/extract-steam-app-overviews-expression.js` |
| 最近全静态计划 | `/private/tmp/steam-static-classification-plan.json` |
| 最近完整运行时清单 | `/private/tmp/steam-all-overviews.json` |

下文第 3–9 节记录的是 2026-08-22 的旧动态方案和历史背景，不得再把其中的“55个动态收藏”“637款来源”“未分类约593项”当作当前状态，也不得直接运行已丢失的旧 `/Users/wangyifang.com/steam-classify.js`。

## 0.1 如何取得“未分类”的具体游戏（下次直接用此方法）

这次最终有效的方法不是扫描安装目录、解析轻量缓存或逐个查询网站，而是：**让正在运行的 Steam 客户端开放本机 CEF 调试端口，再从 Steam 库页面的 React 运行时内存中直接导出完整 `AppOverview` 数组。**

Steam 页面已经在内存中保存了当前账号完整的 AppID、名称、应用类型、商店标签和功能类别。需要从这里读取，而不是把 `localconfig.vdf`、日志、图片缓存或 `appinfo.vdf` 中出现的少量 AppID 当作完整库。

### A. 准备与启动

1. 先备份收藏配置：

   ```zsh
   cp '/Users/wangyifang.com/Library/Application Support/Steam/userdata/89582913/config/cloudstorage/cloud-storage-namespace-1.json' '/private/tmp/cloud-storage-namespace-1.before-read.json'
   ```

2. 正常退出 Steam，确认 `steam_osx` 和 `Steam Helper` 都已结束。
3. 使用 Steam 自带的 CEF 调试参数启动：

   ```zsh
   open -n '/Applications/Steam.app' --args -cef-enable-debugging -devtools-port 8080
   ```

4. 等待 Steam 登录并加载“库”，然后检查调试目标：

   ```zsh
   curl -s http://127.0.0.1:8080/json/list
   ```

   选择标题为 `Steam` 的目标，而不是 `SharedJSContext`、商店页面或弹出菜单；使用其中的 `webSocketDebuggerUrl` 连接 Chrome DevTools Protocol（CDP）。

### B. 进入未分类并取得完整数组

Steam 使用内存路由，浏览器地址栏仍可能显示 `steamloopback.host/index.html`。不要依赖 `location.pathname`。应从“主页”链接的 React Fiber 中找到 Router 的 `history.push`，然后执行：

```js
history.push('/library/collection/uncategorized')
```

如果要取得括号分母对应的**全部未分类条目**，应先把顶部应用类型筛选临时改为“全部”，再进入该路由；保持原筛选时导出的只是括号分子对应的可见条目。本次原始状态分别为 22,897 和 22,376。

进入“未分类”后，页面只渲染屏幕附近的几十个卡片，但 React 组件属性中保存着整个集合。取得方法：

1. 找到一个游戏卡片元素；当前 Steam 版本的卡片类名曾为 `.WYgDg9NyCcMIVuMyZ_NBC`。类名可能随 Steam 更新而改变，失效时应改为查找 `role="grid"` 下带 `role="link"` 的游戏卡片。
2. 从元素自身名称以 `__reactFiber$` 开头的属性取得 React Fiber。
3. 沿 `fiber.return` 向上遍历，直到发现：

   ```js
   Array.isArray(fiber.memoizedProps?.appOverviews)
   ```

4. `fiber.memoizedProps.appOverviews` 就是当前集合的完整可见条目数组，不需要滚动 2 万多次。每项通常包含：

   - `appid`
   - `display_name`
   - `app_type`
   - `m_setStoreTags`
   - `m_setStoreCategories`
   - 评价、手柄、VR、发布时间等附加字段

项目中已经准备好执行和导出脚本：

```zsh
node scripts/steam-cdp-eval.js \
  'Steam$' \
  @scripts/extract-steam-app-overviews-expression.js \
  /private/tmp/steam-unclassified-overviews.json
```

导出后必须检查数量和 AppID 唯一性：

```zsh
node -e "const x=require('/private/tmp/steam-unclassified-overviews.json'); console.log(x.length, new Set(x.map(a=>a.appid)).size)"
```

### C. 分子、分母和完整游戏库的区别

截图中的 `未分类 (22376/22897)` 含义是：

- `22,376`：在当时顶部应用类型筛选下可见的未分类条目。
- `22,897`：不考虑顶部应用类型筛选时，该未分类收藏的总条目。
- 它们都不是完整 Steam 库数量。

要取得完整库，应把顶部应用类型临时切换为“全部”，再通过 Router 进入：

```js
history.push('/library/collection/all-apps-alpha')
```

然后用相同的 React Fiber 方法导出 `appOverviews`。本次取得的是 **26,834 个唯一 AppID**。导出完成后，要把顶部筛选恢复为用户原来的“游戏、原声音轨、软件和工具”。

### D. 导出时的两个陷阱

1. `m_setStoreTags` 和 `m_setStoreCategories` 是 MobX 可观察集合，不一定通过原生 `instanceof Set` 判断。应优先检查 `value[Symbol.iterator]`，再用 `Array.from(value)` 导出，否则会错误得到空对象 `{}`。
2. `window.appStore` 和 `window.collectionStore` 在当前正式版 Steam 的默认 CDP 执行上下文中可能是 `undefined`。不要因此判断数据不存在；直接从已渲染卡片的 React Fiber 向上寻找 `memoizedProps.appOverviews` 更可靠。

### E. 不要再次长时间尝试的办法

- `localconfig.vdf`：本次只有约 2,151 个应用状态，不是完整库。
- `appinfo.vdf`：只含 Steam 当前缓存过的应用；本次相关候选只有约 3,906 个，不是账号全部授权。
- `steamui_librarycache.txt`：日志中只能拼出约 4,503 个 AppID，也不完整。
- `librarycache` 图片目录：只代表缓存过封面或访问过的项目。
- SteamSpy/商店接口逐个查询：适合补少量资料，不适合先发现和查询两万多个账号条目。
- 在虚拟列表中逐屏滚动：页面组件已经持有完整数组，没有必要滚动 4,000 多行。

### F. 写入与最终验证

读取和生成计划时可以让 Steam 保持运行，但**写收藏配置前必须完全退出 Steam**，否则客户端可能覆盖文件。写入后重新启动 Steam，并再次通过 Router 打开 `/library/collection/uncategorized`：

- 页面应显示 `未分类 (0)`；
- 正文应显示“空空如也”；
- 生成收藏的 AppID 并集必须与完整库 AppID 集合相等；
- 所有生成收藏的 `filterSpec` 必须为空。

验证完成后关闭调试版 Steam，以普通方式重新打开，确认 `127.0.0.1:8080` 已不再监听。

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

本节保留的是旧动态方案时期的限制。其中“轻量读取应低于约 1 MB”不适用于第 0.1 节的 Steam 运行时完整导出；当前优先采用第 0.1 节的方法，且仍然不需要扫描安装目录或反复解析 `appinfo.vdf`。

其余安全要求仍须遵守：

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

脚本会采用临时文件加原子重命名写入，并把新增、更新和删除的收藏键加入 `.modified.json`，让 Steam 云同步知道哪些收藏发生了变化。删除旧收藏时还必须在主配置中保留 `is_deleted: true` 的墓碑记录；只有从数组中删掉键不足以让云端删除它。

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
