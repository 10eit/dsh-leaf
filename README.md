# dsh-leaf

**DeepSeek Harness 的 LaTeX 投稿工作区插件。** 一个工作区承载一个完整 LaTeX 项目：普通对话继续做实验、写代码、画图，dsh-leaf 负责把同一目录识别为项目，并提供文件树、源码编辑、编译流水线与论文 PDF 预览。

> 版本：0.1.0 ｜ 目标宿主：DeepSeek Harness 0.2.2-rc.1（Web / Desktop） ｜ 平台：macOS（本地 TeX 环境）
>
> 本仓库同时是插件包与示例项目。示例论文在 [`examples/paper/`](examples/paper/)，可直接用面板打开仓库根目录、把主文档选为 `examples/paper/main.tex` 试用。

## 1. 已实现能力

| 领域 | 能力 |
| --- | --- |
| 工作区入口 | 工作区右键只有一个开关「启用/关闭 DSH-leaf 工作台」：启用后工作区置顶并改名为 dsh-leaf（原名保存在项目记录，关闭时恢复），同时创建一个**置顶的持久会话「DSH-leaf 工作台」**；点击该会话直接进入写作视图，点其他会话回到原生聊天。侧栏叶子入口与 `⌘⇧L` 仍可用 |
| 项目识别 | 扫描 `\documentclass` 主文档候选；多个候选时不静默猜测，由用户选择；记录主文档、引擎、编译模式、自动编译、图片目录 |
| 文件树 | 写作视图内的可折叠文件列（位于 Agent 输入条上方，不遮挡对话；按需展开、自动刷新、隐藏辅助/隐藏文件、新建、在访达显示）；也保留宿主右侧文件页及其右键「在 dsh-leaf 中打开」/复制路径/复制 LaTeX 片段；大目录不整树扫描 |
| 编辑器 | 多文件标签、LaTeX 语法高亮、行号、虚拟化渲染、当前文件搜索、`⌘S` 保存、停止输入 1.2 秒自动保存、外部修改冲突检测、未保存/保存中/已保存状态；选中范围有独立高亮层，切到 Agent 输入后仍可见；进入工作台自动打开主文档 |
| 编译 | 主文档 + pdfLaTeX/XeLaTeX；完整/快速模式；自动编译（保存后稳定 0.9 秒触发）；手动编译、停止、清理构建缓存；同一项目单构建、最新请求排队 |
| 诊断 | 解析 `-file-line-error` 日志，结构化输出文件/行/消息、警告、缺失宏包与安装建议、日志尾部、完整日志入口；错误可点击跳转 |
| PDF | 右侧论文 PDF 面板；页码/适应宽度/整页/重新载入/导出收进 PDF 标签栏，隐藏内建阅读器的黑色工具栏；编译失败保留上次成功 PDF 并标注旧版；导出前强制完整编译 |
| 资源预览 | PNG/JPG/GIF/WebP/SVG/PDF 应用内预览；显示相对路径、大小、更新时间；复制相对路径、复制 `\includegraphics` 片段、在访达中显示 |
| 环境 | 在后台检测发行版、pdflatex/xelatex/latexmk/bibtex/biber/synctex；用最小示例做真实编译验证；检测/验证失败给出非阻塞说明，不自动下载 |
| 模板 | 最小中文项目（ctex + XeLaTeX）与最小英文项目（pdfLaTeX）；只新增缺失文件，不覆盖用户内容 |
| Agent 集成 | 原生模型选择与普通对话不变；新增 `latex_project`（status/init/create_file/set_main/clean/diagnostics/assist_probe）与 `latex_build` 两个原生工具；写作视图底部是**圆角三行 Writing Agent 输入框**（参考宿主 composer 样式）：使用原生默认模型在后台生成，结果回到面板，可直接替换选区或追加到文件，不切换主视图；需要工具/审批/历史时仍可交给原生会话 |
| 定位 | 源码 → PDF 的 SyncTeX 正向定位（编辑器按钮）；PDF → 源码的反向查询 API 已提供（见 §6） |

## 2. 安装

本机 profile 已安装并启用该 bundle。重新安装或在新机器上安装：

1. 在 DeepSeek Harness 中使用插件管理器的 `install_bundle`，`target` 指向本仓库的**绝对目录**（本地包以链接方式安装）：

   ```text
   target: /Users/yanlinfu/Documents/dsh-leaf
   ```

   也可以使用 CLI：

   ```sh
   dsh plugin --profile "$DSH_PROFILE" add /Users/yanlinfu/Documents/dsh-leaf
   ```

2. 安装后客户端 bundle 会进入 boot graph；**刷新一次页面**即可在左侧看到 dsh-leaf 图标。
3. 卸载：`remove_bundle`（或 `dsh plugin remove dsh-leaf`）。插件的所有项目记录都写在 `<工作区>/.dsh-leaf/project.json`，卸载不会改动论文、图片、代码或会话。

首次使用不需要配置面板，也不需要迁移目录；已有论文目录可直接作为工作区添加。

## 3. 使用

1. 在左侧工作区列表打开目标工作区（或右键工作区 →「在 dsh-leaf 中打开」）。
2. 点击左侧栏的叶子图标进入 dsh-leaf。首次进入会识别主文档；若存在多个候选，面板会让你明确选择。
3. 在左下文件树中点击 `.tex` 文件开始编辑；点击图片或 PDF 会在中间区域打开资源预览（不会冒充论文编译结果）。
4. 点击「编译」或直接保存（默认自动编译）。右侧显示论文 PDF；失败时保留上次成功版本并标注旧版。
5. 在普通对话里让 Agent 画图或整理数据，产物落在同一工作区的 `figures/` 等目录；文件树与已打开的预览会在稳定写入后自动刷新。
6. 在对话中让 Agent 修复编译错误时，可直接使用 `latex_build`；它返回与界面一致的错误定位、缺失依赖和日志尾部。

示例项目：

```sh
open examples/paper/main.tex      # 也可以只在面板中浏览
```

## 4. 项目结构

```text
.
├── index.js                 # Host 插件入口（routes / tools / prompt section）
├── client.js                # Web 客户端 bundle（window.__ModuleLoader__ 惰性工厂）
├── cordis.patch.yml         # bundle 层：插入一条 Host 插件行
├── lib/
│   ├── paths.js             # 路径围栏、原子 JSON 写入
│   ├── project.js           # 项目记录、主文档识别、文件树、模板、读写
│   ├── tex.js               # 环境检测/最小示例验证、构建队列、日志解析、SyncTeX
│   ├── routes.js            # /dsh-leaf/* 认证 HTTP 路由
│   └── tool.js              # latex_project / latex_build 原生工具
├── test/                    # node:test 单元 + 真实编译 + HTTP 集成测试
├── locale/{zh,en}.json      # 插件管理器展示元数据
├── icon.svg                 # 插件图标
└── examples/paper/          # 示例中文论文项目（main.tex / sections / figures / .bib）
```

插件不写入宿主 profile 的 `cordis.patch.yml`，也不依赖任何 `@deepseek-ai/*` 运行时导入：Host 半只用 Node 内置模块，Client 半只从浏览器模块表取 React。这样本地链接安装、打包安装与源码安装的行为一致。

## 5. 架构

### Host 半

- `inject: ['webServer', 'connection', 'workspaceRegistry']`；工具与提示词分别通过 `ctx.inject(['tools', 'workingDirectory'])`、`ctx.inject(['systemPrompt'])` 可选绑定。
- 所有 HTTP 路由挂在 `/dsh-leaf` 前缀下，先经过 `connection.requestRejection()` 的 Host/Origin 与浏览器登录 Cookie 校验；未认证请求得到 401/403。
- 工作区必须已注册在 `workspaceRegistry` 中（或其子目录），且路径经过 realpath 解析；`safeJoin()` 拒绝任何 `..` 逃逸。
- 每个工作区一份 `.dsh-leaf/project.json`：主文档、构建目录、引擎、模式、自动编译、图片目录、最近构建结果。写入使用临时文件 + rename。
- 编译串行化：同一工作区一个构建；并发请求排队且只保留最新一次；`stop` 终止子进程并结算排队请求。
- 构建输出在 `.dsh-leaf/build/{full,fast}`，清理操作只删除该目录，绝不触碰源码、图片或用户保存的 PDF。
- 默认复用本机 TeX（`/Library/TeX/texbin`、TeX Live、TinyTeX、Homebrew 与 `PATH`）；「可用」以最小示例真实编译通过为准，而不是只看可执行文件存在。

### Client 半

- 注册 `main` 面板 `key: 'leaf'`、`sidebar.panellist` 图标行、工作区右键开关、`⌘⇧L` 快捷键；`shell.overlay` 里的观察器在**持久会话「DSH-leaf 工作台」被选中**时打开写作视图，选中其他会话则保持原生聊天。
- 写作视图：单行工具栏 + 可折叠文件列（在 Agent 输入条上方，不遮挡对话）+ 多文件编辑器 + 底部圆角三行后台 Writing Agent 输入框 + 右侧「论文 PDF / 构建日志」双页。打开项目时自动载入主文档源码；PDF 控件在标签栏，内建阅读器工具栏隐藏；输入框调用原生默认模型，结果内联显示并可写回文件。编辑器选区有独立高亮层，点击输入框后仍能看清选中范围。
- 只使用 React 与 `--dsw-alias-*` 主题 token；浅色/深色跟随宿主，不引入第二套设计系统。
- 面板状态按工作区缓存在内存中：切到普通对话再回来会恢复标签、展开目录与预览；宽度、显示开关、最近工作区写入 `localStorage`。
- 文件树与项目状态轮询只覆盖「根目录 + 已展开目录」，并在数据未变化时跳过 React 更新；编辑器高亮只渲染可视行。

### HTTP 接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/dsh-leaf/health` | 存活检查 |
| GET | `/dsh-leaf/state?workspace=` | 项目、候选主文档、环境、PDF 摘要 |
| POST | `/dsh-leaf/state` | 更新项目设置（主文档/引擎/模式/启用状态） |
| GET | `/dsh-leaf/tree?workspace=&dir=&aux=&hidden=` | 单层目录 |
| GET/POST | `/dsh-leaf/file` | 读取/保存文本（带 `expectedMtime` 冲突检测） |
| POST | `/dsh-leaf/new` | 新建主文档/章节 |
| POST | `/dsh-leaf/init` | 从最小中/英文模板创建项目 |
| POST | `/dsh-leaf/compile` | 编译；可带 `engine`/`mode`/`mainDocument`/`clean` |
| POST | `/dsh-leaf/stop`、`/dsh-leaf/clean` | 停止构建 / 清理缓存 |
| GET | `/dsh-leaf/pdf`、`/dsh-leaf/asset` | 论文 PDF（支持 Range）/ 资源字节 |
| GET | `/dsh-leaf/log` | 最近一次完整构建日志 |
| POST | `/dsh-leaf/reveal` | 在访达/资源管理器中显示 |
| GET | `/dsh-leaf/synctex/forward`、`/dsh-leaf/synctex/inverse` | 双向源码/PDF 定位 |
| GET | `/dsh-leaf/env`、POST `/dsh-leaf/env/probe` | 环境检测 / 最小示例验证 |

`POST` 请求的 `workspace` 放在 JSON body 中；`GET` 放在查询串中。

## 6. 与需求文档的对应关系

详见 [`docs/requirements-coverage.md`](docs/requirements-coverage.md) 与 [`docs/verification.md`](docs/verification.md)。摘要：

- **已闭环**：工作区启用/关闭（右键 + 保存显式关闭）、主文档与编译入口、文件树与自动刷新、多文件编辑与保存冲突、完整/快速编译、错误定位、旧 PDF 标记、快速草稿标注与导出前完整编译、图片/PDF 预览、最小中英文模板、缺失宏包提示、环境检测与真实验证、单构建调度与停止、Agent 编译工具。
- **部分实现**：左右分栏布局比例与可拖拽已实现，但宿主 Slot 不提供「左下文件树」的位置（见下）；SyncTeX 正向定位已在 UI 接通，反向定位只提供 Host API；PDF 页码/缩放使用 Chromium 内建阅读器。
- **未纳入首版**：行内差异审阅/逐项接受（Writing Agent 仍按原生工具修改文件）、本地模板目录导入、自动下载安装 TeX、LuaLaTeX、PDF 批注、完整大纲、富文本。

### 关于「左侧栏下半部分文件树」

宿主把左栏内容声明为一个 `single` 占位（`sidebar.workspaces`），由工作区浏览器独占；没有可以追加第二个面板的 slot，替换它则会丢失工作区/会话浏览。dsh-leaf 因此把项目文件树放在写作视图左轨（与源码、PDF 同屏），并保留宿主右侧的「文件」页。需求文档 §13 已把「工作区和侧栏扩展」列为需宿主验证的能力；这里的做法是宿主能力边界内的实现，而不是用外部窗口冒充。

### 关于 Writing Agent

dsh-leaf 不创建第二套 Agent runtime 或模型选择：普通对话、模型列表、权限与工具体系保持原生。写作视图的输入条把文件、行号和选区发给 `/dsh-leaf/assist`，Host 使用原生默认模型做**一次后台生成**并把结果写回面板（可替换选区或追加到文件，带过期检查）。它不使用工具、不写会话历史，因此适合润色/改写/解释；需要工具调用、审批和完整历史时，仍用「交给 Writing Agent」进入原生会话。宿主没有暴露可嵌入的聊天组件，所以聊天记录不在插件面板内重绘。部分引用/误改检查仍以用户审阅为准；Agent 的文件修改走宿主原生工具与权限提示。

## 7. 性能措施

- 文件树逐层读取；不扫描未展开目录，不递归监听。
- 主文档扫描缓存 15 秒；面板轮询只刷新可见/展开目录，并在 JSON 未变化时不触发 React 更新。
- 编辑器对高亮层做可视区域虚拟化；输入用透明文本层 + 独立语法层，中文输入法组合期间自动切回原生文本显示。
- 编译按工作区串行、最新请求覆盖旧排队；自动编译在保存后防抖 0.9 秒。
- 未打开 dsh-leaf 面板时，插件不进行目录扫描或编译。

## 8. 开发与测试

```sh
npm test          # 26 个测试：单元、日志解析、真实编译、HTTP/Range/认证围栏、后台生成、客户端渲染
npm run check     # 所有 JS 文件语法检查
```

测试中真实编译会用本机 TeX；没有 LaTeX 的机器上相关用例自动 skip。修改 Host 代码后，在插件管理器里对 `dsh-leaf` 关闭再启用即可重载；修改 `client.js` 后刷新页面（客户端 bundle 由 boot graph 带版本哈希提供）。

## 9. 已知限制

- 一个工作区一个项目（首版约定）；不解析多项目嵌套。
- 编辑器撤销栈跟随当前文本区域，不按文件独立保存；没有章节大纲和跨文件搜索替换。
- 快速模式通过 `\PassOptionsToPackage{draft}{graphicx}` 实现，图像占位依赖 `graphicx`；TikZ 等图形的计算不会被跳过（与需求§8.3 一致）。
- PDF 预览使用 Chromium 内建阅读器（iframe），因此缩放/页码控件由浏览器提供，而非自绘 PDF 阅读器；导出走 Host 的 Range 路由。
- 环境安装只做引导，不自动下载/安装；宏包缺失给出 `tlmgr` 建议，不自动执行。
- 左侧栏下半文件树受宿主 Slot 限制，见 §6。
- 卸载/关闭插件不会删除 `.dsh-leaf/` 与构建产物，可按需手动清理。

## 10. 版本管理

仓库使用 git 管理；每个可验证阶段一次提交（脚手架 → Host 构建管线 → 客户端面板 → 测试与文档）。`git log --oneline` 查看演进。
