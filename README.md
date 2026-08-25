# Steam Library Classification Rules

从 Steam 客户端运行时读取完整应用清单，并以确定性规则生成纯静态收藏。

> [!WARNING]
> 这是修改 Steam 内部收藏配置的实验性工具，不是 Valve 官方项目。默认只生成预览；只有显式使用 `--apply` 才会写入，写入前必须完全退出 Steam。

## 分类方式

规则综合 Steam 标签、功能类别、应用类型、名称与少量人工白名单。一项内容可以进入多个收藏，但最终收藏 AppID 并集必须与导出的完整库完全一致。

2026-08-24 的个人库验证覆盖 26,840 个唯一 AppID，生成 68 个静态收藏，遗漏与额外均为 0。这只是一次个人快照，不是仓库内置数据，也不代表其他账号应有相同数量。

## 要求

- Steam 桌面客户端
- Node.js 22 或更高版本
- 可完全退出并重启 Steam
- 能访问本机 Steam 用户配置目录

## 使用

完全退出 Steam，再以仅监听本机的 CEF 调试端口启动。

macOS：

```bash
open -n '/Applications/Steam.app' --args -cef-enable-debugging -devtools-port 8080
```

Windows PowerShell：

```powershell
& 'C:\Steam\steam.exe' -cef-enable-debugging -devtools-port 8080
```

在 Steam 库中显示全部应用，然后导出运行时清单：

```bash
node scripts/steam-cdp-eval.js \
  'Steam$' \
  @scripts/extract-steam-app-overviews-expression.js \
  /path/to/steam-all-overviews.json
```

设置账号、Steam 根目录、清单和预览输出路径后运行：

```bash
export STEAM_ACCOUNT_ID='你的 AccountID'
export STEAM_ROOT='/path/to/Steam'
export STEAM_INVENTORY_PATH='/path/to/steam-all-overviews.json'
export STEAM_PLAN_PATH='/path/to/steam-static-classification-plan.json'
node steam-static-classify.js
```

确认 AppID 并集完整、遗漏与额外均为 0、所有收藏均为静态。随后完全退出 Steam，再执行：

```bash
node steam-static-classify.js --apply
```

完整路由、Windows 环境变量、旧收藏清理与排错见 [Steam 游戏库整理规则](./Steam游戏库整理规则.md)。

## 安全与同步

- 不要提交个人库清单、Steam 配置、备份、日志或崩溃转储
- CEF 调试端口只在导出时启用，完成后普通重启 Steam，并确认 `8080` 不再监听
- 不要在 Steam 运行时写收藏 JSON，也不要删除整个 `userdata` 或授权数据
- 收藏使用客户端内部 CloudStorage；界面看似正常不代表上传完成，应确认 namespace 1 最终为 `0 modified`
- 多台电脑使用同一账号时，完成同步验证前不要在其他设备编辑收藏

Steam 内部结构与同步行为可能随版本变化，运行前应检查脚本与客户端状态。

## 版权说明

原创代码依据 [Apache License 2.0](./LICENSE) 发布。个人品牌和素材不在许可范围内。
