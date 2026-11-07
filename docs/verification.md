# 安装与验证记录

环境：macOS · DeepSeek Harness 0.2.2-rc.1（Web/Desktop，profile `desktop`）· TeX Live 2026 basic（`/usr/local/texlive/2026basic`，`/Library/TeX/texbin` 已加入 PATH）。

## 1. 安装

通过插件管理器的 `install_bundle` 以本地目录安装（等价于 `dsh plugin --profile "$DSH_PROFILE" add /Users/yanlinfu/Documents/dsh-leaf`）：

```json
{"stage":"install","target":"dsh-leaf","enabled":true,"changed":true,
 "packageResult":{"exitCode":0,"output":"+ dsh-leaf 0.1.0 <- ../../../Documents/dsh-leaf"}}
```

首次安装时 Host 半在 `ctx.get('tools')` 上报错：

```
dsh-leaf: Error: cannot get property "tools" without inject
```

修正为 `ctx.inject(['tools', 'workingDirectory'], …)` 与 `ctx.inject(['systemPrompt'], …)` 后重新启用：

```json
{"stage":"enable","target":"include:dsh-leaf","enabled":true,"changed":true,
 "application":"applied","warnings":[]}
```

插件行状态：`include:dsh-leaf` → `enabled: true`, `fiberPhase: active`。

## 2. Host 半

### 2.1 工具注册

`latex_project(action="status")` 实际输出：

```text
Workspace: /Users/yanlinfu/Documents/dsh-leaf/examples/paper
Main document: main.tex
Engine: xelatex | mode: fast | auto compile: true
Environment: detected (available)
Main candidates: main.tex
Figures directory: figures
```

`latex_build(mode="full")` 对示例论文完整编译（含 ctex 中文、`\includegraphics` PDF 图、bibtex 参考文献）：

```text
Build success in 1.5s (xelatex, full).
Main document: examples/paper/main.tex
```

产物：`.dsh-leaf/build/full/main.pdf`（2 页）。ctex 的 “You have requested release …” 属于发行版簿记信息，解析器会过滤，不计入文档警告。

另外验证了「主文档位于子目录」的默认工作目录规则：以仓库根目录为工作区、主文档为 `examples/paper/main.tex` 时，构建 cwd 自动取 `examples/paper`，输出仍写入根目录 `.dsh-leaf/build/full/main.pdf`，编译成功。

### 2.2 SyncTeX

```text
synctex view -i 12:1:<abs>/sections/introduction.tex -o <abs>/.dsh-leaf/build/full/main.pdf
→ { page: 1, x: 168.04, y: 642.36 }
```

### 2.3 后台写作调用

后台生成走 Host 的原生默认模型（`ctx.llm.stream`），用工具探针验证真实调用：

```text
latex_project(action="assist_probe", instruction="Reply with exactly: OK")
→ deepseek-flash: OK
```

客户端 `/dsh-leaf/assist` 复用同一个函数；输入条把当前文件/选区/主文档发给它，结果内联显示，写回时检查选区原文是否变化。

### 2.4 持久工作台会话

`workbench_probe` 真实创建了一个置顶工作台会话：

```text
workbench session session-18501068-71db-46c5-8323-0046dda1c41b (created)
```

会话日志确认了 `session/title = "✏️DSH-leaf工作台"`、`turn/start`，以及 700ms 后的 `turn/end (aborted: user)`；workspace 存储中出现该 session、`pinnedSessionIds` 和工作区置顶记录。首次启用只消耗一个被立即取消的模型轮次，用来让会话从空白占位变成持久行。

### 2.5 PDF 文本层与反向定位

`tools/pdfhelper.swift` 用 macOS PDFKit 生成页图和逐词框：

```text
words 53 pages 2 size 595.28 841.89
png .dsh-leaf/build/pdfpage/v1-1-1-2.png
```

用词框中心调用 SyncTeX inverse，真实映射到：

```text
1:326:183 → main.tex:13
1:300:484 → sections/introduction.tex:7
```

客户端自绘页图 + 隐形文本层，选中 PDF 文字后取词框中心调用 `/dsh-leaf/synctex/inverse`，打开对应源码并跳行；无法建立文本层时回退内建阅读器。

### 2.6 环境检测

```text
status: detected, available: true
xelatex / pdflatex / latexmk / bibtex / biber / tlmgr / synctex: 全部找到
```

「最小示例验证」由 `POST /dsh-leaf/env/probe` 在临时目录真实编译 `\documentclass{article}` 文档，成功后才把状态置为 `ready`。

## 3. Client 半

`dsh-client-modules` 的 boot graph 包含 dsh-leaf，且位于 `application` batch（与其它客户端插件同批加载）：

```json
{"id":"dsh-leaf","url":"plugins/??dsh-leaf/client.js&rev=<artifact rev>","rev":"<artifact rev>"}
```

rev 由 `client.js` 的 mtime/ctime/size 计算，每次保存都会变化；`latex_project(action="diagnostics")` 可读取当前 graph。用图中的精确 rev 取回 bundle：

```text
GET /plugins/??dsh-leaf/client.js&rev=<artifact rev>
→ 200, text/javascript, ~120 KB
```

bundle 尾部为 `//# sourceMappingURL=??dsh-leaf/client.js.map&rev=…`，可检索到最新代码标记（`paper.exportFailed`、`editor.toAgent`、`log.fixAgent` 等）。

### 3.1 无浏览器环境下的替代验证

- **模块格式**：加载 `client.js`，校验 `window.__ModuleLoader__.load` 的 id 与 factory，调用 factory(require) 得到 `{ inject, apply }`。
- **注册表**：用 mock ctx 调用 `apply`，确认注册了 `main/leaf`、`sidebar.panellist/leaf`、`contextMenu.icon/dsh-leaf.open`、两个工作区菜单动作与 `dsh-leaf.open` 快捷键；样式节点只注入一次。
- **渲染**：用 `react-dom/server` 渲染面板（空工作区 / 有工作区但尚未取到 state 两种输入），无异常，输出包含工具栏、文件树、论文 PDF 面板。
- **静态检查**：`npm run check` 对所有 JS 文件通过。

### 3.2 尚未完成的验证

**当前打开的页面需要刷新一次**：dsh-leaf 是在页面加载之后安装的客户端 bundle，不会自动注入已存在的页面；HMR 只对已加载的插件生效。刷新后应能：

1. 在左侧「插件 / 自动化任务」同一栏看到叶子图标；
2. 点击后进入 dsh-leaf，看到示例项目或空项目引导；
3. 右键工作区看到「在 dsh-leaf 中打开 / 关闭 dsh-leaf」；
4. `⌘⇧L` 打开面板。

当前 agent 环境没有浏览器控制能力，**未对页面截图或做视觉验收**。刷新后若发现渲染问题，请把控制台报错（`slot entry crashed in 'main'` 等）反馈，我会按实际错误修正。

## 4. 自动化测试

```text
$ npm test
# tests 28
# pass 28
# fail 0
```

覆盖：

- 客户端 bundle：加载 `client.js`、校验 `__ModuleLoader__` 工厂、apply 注册项（main / 侧栏 / 右键 / 快捷键）与空/有工作区两种面板渲染；
- 后台生成：prompt 组装、文本增量拼接、错误/空答案、文件截断，以及 `/assist` 路由契约；
- 路径围栏、主文档识别与候选歧义、项目记录持久化与显式关闭；
- 文件树隐藏规则、文本读写与外部修改冲突；
- 模板只增不覆盖、新建 TeX 文件拒绝覆盖；
- LaTeX 日志解析（含 TeX 79 列换行把 `file:line:` 截断的情况）、缺失宏包提示、日志尾部裁剪；
- 真实 xelatex 编译成功 / 失败诊断；
- HTTP 路由：state/tree/new/file 往返、401 认证围栏、未注册工作区 403、编译产物 PDF、Range 206。

## 5. 复现验证

```sh
cd /Users/yanlinfu/Documents/dsh-leaf
npm run check
npm test

# 编译示例论文
# 在 dsh 中调用：latex_build(mode="full", workspace=".../examples/paper")
```

重新加载 Host 改动：插件管理器对 `dsh-leaf` 关闭 → 启用。客户端改动：刷新页面；boot graph 的 rev 会随文件 mtime 变化（`latex_project(action="diagnostics")` 可读取当前 Client graph）。
