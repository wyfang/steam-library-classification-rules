# Steam Library Classification Rules

一套面向超大型 Steam 库的个人收藏整理工具。它从正在运行的 Steam 客户端读取完整应用清单，按照 Steam 商店标签、功能类别、应用类型、名称规则和少量人工白名单，生成纯静态收藏。

> [!WARNING]
> 这是会修改 Steam 客户端内部收藏配置的高级工具，不是 Valve 官方项目。默认只生成预览；只有显式传入 `--apply` 才会写入。写入前必须完全退出 Steam。

## 当前验证状态

2026-08-24 在同一账号上完成了 macOS 与 Windows 验证：

- Windows 运行时导出 26,840 个唯一 AppID；
- 生成 68 个全静态收藏；
- 收藏 AppID 并集覆盖 26,840/26,840，遗漏 0、额外 0；
- Steam 客户端显示 `未分类 (0)`；
- 旧 `uc-ai-v2-*` 收藏通过删除墓碑清理；
- 收藏云同步队列最终为 `0 modified`。

这些数字是一次个人库快照，不是仓库内置数据，也不代表其他账号应有相同数量。

## 它如何分类

仓库不包含完整个人游戏清单。清单在每次运行时从 Steam 库页面的 React 运行时内存中导出，主要字段包括 AppID、名称、应用类型、商店标签和功能类别。

`steam-static-classify.js` 再使用确定性规则分类：

- Steam 标签：动作、FPS、RPG、策略、模拟、恐怖等；
- 功能类别：单人、多人、在线合作、本地合作、手柄等；
- 应用类型：游戏、Demo、Beta、原声音轨、软件、工具、视频；
- 名称规则：Demo、Beta、Playtest、Prologue 等测试版本标识；
- 人工规则：热门 3A 白名单及个人维护的特殊收藏；
- 兜底规则：缺少玩法标签的正式游戏和各种非游戏内容。

一款游戏可以同时进入多个收藏。最终计划必须验证收藏 AppID 并集与导出的完整库一致。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `steam-static-classify.js` | 生成预览，并在 `--apply` 时写入全静态收藏 |
| `scripts/steam-cdp-eval.js` | 通过本机 CEF 调试端口执行只读导出表达式 |
| `scripts/extract-steam-app-overviews-expression.js` | 从 React 组件读取完整 `AppOverview` 数组 |
| `scripts/remove-legacy-steam-collections.ps1` | 在 Windows 上为旧收藏写入删除墓碑 |
| `scripts/remove-legacy-steam-collections.cmd` | Windows 一键入口 |
| `Steam游戏库整理规则.md` | 完整规则、历史背景、排错过程和验证标准 |

## 环境要求

- Steam 桌面客户端；
- Node.js 22 或更高版本；
- 能够完全退出并重新启动 Steam；
- macOS、Windows 或 Linux 上可访问 Steam 用户配置目录；
- 操作者理解 JSON、环境变量和命令行的基本用法。

## 基本流程

### 1. 导出完整运行时清单

完全退出 Steam，然后启用仅监听本机的 CEF 调试端口启动客户端。

macOS：

```bash
open -n '/Applications/Steam.app' --args -cef-enable-debugging -devtools-port 8080
```

Windows：

```powershell
& 'C:\Steam\steam.exe' -cef-enable-debugging -devtools-port 8080
```

在 Steam 中打开“库”，将应用类型设为“全部”，关闭“仅显示准备就绪的游戏”，并进入全部应用集合。然后导出：

```bash
node scripts/steam-cdp-eval.js \
  'Steam$' \
  @scripts/extract-steam-app-overviews-expression.js \
  /path/to/steam-all-overviews.json
```

必须确认导出数量与 AppID 唯一数量一致。详细的路由进入方法和 React Fiber 排错说明见《Steam游戏库整理规则.md》。

### 2. 只生成预览

macOS/Linux 示例：

```bash
export STEAM_ACCOUNT_ID='你的 AccountID'
export STEAM_ROOT='/path/to/Steam'
export STEAM_INVENTORY_PATH='/path/to/steam-all-overviews.json'
export STEAM_PLAN_PATH='/path/to/steam-static-classification-plan.json'
node steam-static-classify.js
```

Windows PowerShell 示例：

```powershell
$env:STEAM_ACCOUNT_ID = '你的 AccountID'
$env:STEAM_ROOT = 'C:/Steam'
$env:STEAM_INVENTORY_PATH = 'C:/path/to/steam-all-overviews.json'
$env:STEAM_PLAN_PATH = 'C:/path/to/steam-static-classification-plan.json'
node .\steam-static-classify.js
```

检查计划中的收藏数量、每类条目以及以下不变量：

- 完整库 AppID 数量等于收藏 AppID 并集；
- 遗漏和额外 AppID 均为 0；
- 所有收藏均为静态，`filterSpec` 为空；
- 收藏夹和已隐藏不属于脚本覆盖范围。

### 3. 写入

完全退出 Steam，确认 `steam`、`steamwebhelper`、`steam_osx` 和 Steam Helper 均已结束，然后执行：

```bash
node steam-static-classify.js --apply
```

重新启动 Steam，检查 `未分类 (0)`、旧收藏删除状态及云同步队列。

## 云同步的重要限制

Steam 收藏使用客户端内部 CloudStorage 命名空间，与普通游戏存档的 Steam Cloud 状态不是同一个可见检查点。

本项目曾观察到：70 个修改键合并为约 1.7 MiB 请求时，服务器返回 `EResult 2`，客户端进入指数退避，而普通界面仍可能看似已经同步。小批量或逐键上传可以成功，但当前仓库没有把这一内部、版本敏感的批量上传流程封装成通用命令。

因此全量写入后必须检查：

- `cloud-storage-namespace-1.modified.json` 最终变为 `[]`；
- Steam 日志显示 namespace 1 为 `0 modified`；
- 另一台电脑下载后仍是相同的收藏数量和 AppID 并集。

如果修改键长期不清空，请停止在其他电脑上编辑收藏，并先阅读规则手册中的 Windows 云同步记录。

## 安全与隐私

- 不要提交导出的个人库清单、Steam 配置、备份、日志或崩溃转储；`.gitignore` 已覆盖常见文件名。
- CEF 调试端口会向本机其他进程暴露 Steam UI 的调试接口。只在导出期间启用，完成后以普通方式重启 Steam，并确认 8080 端口不再监听。
- 不要在 Steam 运行时直接写收藏 JSON，客户端可能覆盖文件。
- 不要删除整个 `userdata`、游戏安装目录或授权数据。
- 本仓库包含项目作者的公开 Steam 标识符和历史路径示例，但不包含密码、令牌、Cookie 或登录会话。

## 项目定位

这是针对个人超大型 Steam 库形成的实验性工具和复用手册。Steam 客户端内部结构、React 类名和 CloudStorage 行为可能随版本变化；运行前应检查脚本和当前客户端状态，不应把它当作稳定的官方 API。

仓库目前未附开源许可证。公开可见不等于自动授予复制、修改或再分发权限；如需允许他人复用，建议由仓库所有者另行选择并添加许可证。
