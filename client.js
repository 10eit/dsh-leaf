/**
 * dsh-leaf — browser half.
 *
 * Hand-authored client bundle in the loader's lazy-factory format. It imports
 * only React from the browser module table (no Harness Client package values),
 * speaks to the Host through the authenticated `/dsh-leaf/*` routes, and styles
 * itself with `--dsw-alias-*` theme tokens so light/dark follow the host.
 */
window.__ModuleLoader__.load({
  id: 'dsh-leaf',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const NS = 'dsh-leaf'
    const STORAGE = {
      workspace: 'dsh-leaf.workspace',
      engine: 'dsh-leaf.engine',
      mode: 'dsh-leaf.mode',
      treeWidth: 'dsh-leaf.treeWidth',
      paperWidth: 'dsh-leaf.paperWidth',
      showHidden: 'dsh-leaf.showHidden',
      showAux: 'dsh-leaf.showAux',
      logOpen: 'dsh-leaf.logOpen',
    }
    const PANEL_ID = 'leaf'
    const MENU_OPEN = 'dsh-leaf.open'
    const MENU_CLOSE = 'dsh-leaf.close'

    /* ------------------------------------------------------------------ */
    /* Dictionaries                                                        */
    /* ------------------------------------------------------------------ */

    const zh = {
      panel: 'dsh-leaf',
      'panel.open': '打开 dsh-leaf',
      'menu.open': '在 dsh-leaf 中打开',
      'menu.close': '关闭 dsh-leaf',
      'menu.disabled': '已关闭此工作区的 dsh-leaf；项目文件与会话保持不变。',
      'menu.copySnippet': '复制 LaTeX 插入片段',
      'menu.copySnippetDone': '已复制 LaTeX 插入片段，可粘贴到章节文件中。',
      'menu.copyPathDone': '已复制相对路径。',
      'toolbar.workspace': '工作区',
      'toolbar.main': '主文档',
      'toolbar.engine': '引擎',
      'toolbar.mode': '编译模式',
      'toolbar.mode.full': '完整',
      'toolbar.mode.fast': '快速',
      'toolbar.auto': '自动编译',
      'toolbar.compile': '编译',
      'toolbar.compiling': '编译中…',
      'toolbar.stop': '停止',
      'toolbar.clean': '清理缓存',
      'toolbar.refresh': '刷新',
      'toolbar.env': 'LaTeX 环境',
      'toolbar.settings': '项目设置',
      'toolbar.more': '更多操作',
      'tree.title': '文件',
      'tree.new': '新建 TeX 文件',
      'tree.init': '从模板创建项目',
      'tree.showHidden': '显示隐藏文件',
      'tree.showAux': '显示编译辅助文件',
      'tree.refresh': '重新读取',
      'tree.empty': '目录为空',
      'tree.truncated': '目录过大，仅显示前 500 项；请用搜索或在访达中查看。',
      'tree.loading': '读取中…',
      'tree.error': '读取失败',
      'tree.reveal': '在访达中显示',
      'tree.copyPath': '复制相对路径',
      'main.ambiguous': '检测到多个主文档候选，请在“主文档”中选择编译入口。',
      'editor.empty': '从左侧选择文件开始编辑',
      'editor.emptyHint': '也可以新建章节或从模板创建项目。',
      'editor.unsaved': '未保存',
      'editor.saving': '保存中…',
      'editor.saved': '已保存',
      'editor.saveFailed': '保存失败',
      'editor.conflict': '文件已被外部修改',
      'editor.conflictHint': '保存前请选择重新加载磁盘内容，或确认覆盖外部修改。',
      'editor.reload': '重新加载',
      'editor.overwrite': '覆盖保存',
      'editor.close': '关闭标签',
      'editor.find': '搜索当前文件',
      'editor.findNext': '下一个',
      'editor.save': '保存',
      'editor.line': '行',
      'editor.column': '列',
      'editor.locatePdf': '定位到 PDF',
      'editor.copyRef': '复制引用',
      'editor.toAgent': '交给 Writing Agent',
      'editor.agentPromptTitle': '请作为 Writing Agent 帮我修改这段 LaTeX。',
      'editor.agentPromptFile': '文件：{path}（第 {from} 行到第 {to} 行）',
      'editor.agentPromptSelection': '选中的源码如下：',
      'editor.agentPromptAsk': '要求：',
      'editor.copied': '已复制引用，可粘贴到对话中。',
      'editor.locateFailed': '定位失败：请重新完整编译后再试。',
      'paper.title': '论文 PDF',
      'paper.empty': '尚未编译',
      'paper.emptyHint': '点击“编译”生成论文 PDF。编译失败时保留上一次成功的版本并标注为旧版。',
      'paper.stale': '当前显示的是上一次成功编译的旧版 PDF，最新源码尚未编译成功。',
      'paper.draft': '当前显示的是快速模式草稿，导出前会重新完整编译。',
      'paper.page': '页',
      'paper.fit': '适应',
      'paper.fitWidth': '适应宽度',
      'paper.fitPage': '适应整页',
      'paper.reload': '重新载入',
      'paper.export': '导出 PDF',
      'paper.exportFailed': '导出已取消：最新源码没有完整编译成功，不会静默导出旧版或草稿。',
      'paper.openNew': '在新标签页打开',
      'log.title': '构建输出',
      'log.problems': '问题',
      'log.raw': '日志',
      'log.empty': '还没有编译记录。',
      'log.noProblems': '没有错误或警告。',
      'log.missing': '缺失依赖',
      'log.show': '展开构建输出',
      'log.hide': '收起构建输出',
      'log.full': '查看完整日志',
      'log.fixAgent': '交给 Writing Agent 修复',
      'log.fixPromptTitle': '这轮 LaTeX 编译失败，请作为 Writing Agent 帮我定位并修复。',
      'log.fixPromptMeta': '主文档：{main}；引擎：{engine}；模式：{mode}',
      'log.fixPromptErrors': '错误与警告：',
      'status.idle': '未编译',
      'status.dirty': '源码已更新',
      'status.building': '编译中',
      'status.success': '编译成功',
      'status.warning': '编译成功（有警告）',
      'status.failed': '编译失败',
      'status.stopped': '已停止',
      'status.timeout': '编译超时',
      'status.noEnvironment': '缺少 LaTeX 环境',
      'env.ready': '环境可用',
      'env.detected': '环境待验证',
      'env.partial': '缺少部分组件',
      'env.missing': '未安装',
      'env.failed': '检测失败',
      'env.title': 'LaTeX 环境',
      'env.probe': '用最小示例验证',
      'env.probing': '正在编译最小示例…',
      'env.redetect': '重新检测',
      'env.engines': '工具',
      'env.distribution': '发行版',
      'env.probeOk': '最小示例编译通过，可以开始写作。',
      'env.probeFailed': '最小示例编译失败。请检查安装或选择其他工具链。',
      'env.installHint': '未检测到 LaTeX。可安装 BasicTeX 或 TeX Live，安装完成后重新检测；本插件不会自动下载或重装环境。',
      'env.partialHint': '基础引擎可用，但缺少文献处理或 SyncTeX 等组件，相关功能会受限。',
      'env.missingHint': '请先安装本地 LaTeX 发行版。安装期间仍可编辑源码、浏览文件与普通对话。',
      'env.recheck': '重新检测',
      'modal.newFile': '新建 TeX 文件',
      'modal.fileName': '文件名',
      'modal.fileNameHint': '例如 sections/related-work.tex',
      'modal.kind': '文件类型',
      'modal.kind.main': '主文档',
      'modal.kind.section': '章节文件',
      'modal.title': '标题',
      'modal.folder': '目录',
      'modal.create': '创建',
      'modal.cancel': '取消',
      'modal.init': '从模板创建项目',
      'modal.template': '模板',
      'modal.template.zh': '最小中文论文（XeLaTeX）',
      'modal.template.en': '最小英文论文（pdfLaTeX）',
      'modal.initHint': '只新增缺失文件，不覆盖已有代码、数据、图片或论文。',
      'modal.initRun': '创建项目',
      'modal.settings': '项目设置',
      'modal.mainDoc': '主文档',
      'modal.mainDocHint': '编译始终从主文档出发；打开章节不会改变这个入口。',
      'modal.buildCwd': '编译工作目录',
      'modal.buildCwdHint': '默认为主文档所在目录。留空即使用默认值。',
      'modal.enable': '在此工作区启用 dsh-leaf',
      'modal.enableHint': '关闭后项目文件与会话保留，随时可以重新启用。',
      'modal.save': '保存设置',
      'modal.close': '关闭',
      'welcome.title': '把当前工作区变成 LaTeX 投稿工作区',
      'welcome.body': 'dsh-leaf 把整个目录视为一个 LaTeX 项目：实验代码、数据、图片、参考文献和论文源码留在原地，普通对话继续负责实验与绘图，这里负责写作、编译与 PDF 审阅。',
      'welcome.enable': '启用 dsh-leaf',
      'welcome.initZh': '创建最小中文项目',
      'welcome.initEn': '创建最小英文项目',
      'welcome.disabled': '此工作区已关闭 dsh-leaf',
      'welcome.disabledBody': '项目文件、图片和会话都还在。重新启用只恢复写作视图，不会创建或覆盖任何文件。',
      'welcome.noWorkspace': '选择工作区后查看文件',
      'welcome.noWorkspaceBody': '在左侧工作区列表中打开一个工作区，即可使用 dsh-leaf。',
      'preview.title': '资源预览',
      'preview.image': '图片',
      'preview.pdf': 'PDF',
      'preview.insert': '复制插入片段',
      'preview.inserted': '已复制 \\includegraphics 片段，可粘贴到章节文件中。',
      'preview.copyPath': '复制相对路径',
      'preview.pathCopied': '已复制相对路径。',
      'preview.reveal': '在访达中显示',
      'preview.close': '关闭预览',
      'preview.failed': '无法预览此文件',
      'preview.hint': '可预览 PNG、JPG、SVG 与 PDF；论文编译结果固定显示在右侧。',
      'toast.error': '操作失败',
      'toast.busy': '已有构建在进行中',
      'common.loading': '加载中…',
      'common.retry': '重试',
      'common.unknown': '未知',
      'common.seconds': '秒',
      'common.error': '操作失败',
      'common.updated': '更新于',
      'common.size': '大小',
      'common.pages': '页数',
    }

    const en = {
      panel: 'dsh-leaf',
      'panel.open': 'Open dsh-leaf',
      'menu.open': 'Open in dsh-leaf',
      'menu.close': 'Close dsh-leaf',
      'menu.disabled': 'dsh-leaf is off for this workspace. Project files and sessions are unchanged.',
      'menu.copySnippet': 'Copy LaTeX include snippet',
      'menu.copySnippetDone': 'The LaTeX include snippet is copied.',
      'menu.copyPathDone': 'Relative path copied.',
      'toolbar.workspace': 'Workspace',
      'toolbar.main': 'Main document',
      'toolbar.engine': 'Engine',
      'toolbar.mode': 'Build mode',
      'toolbar.mode.full': 'Full',
      'toolbar.mode.fast': 'Fast',
      'toolbar.auto': 'Auto compile',
      'toolbar.compile': 'Compile',
      'toolbar.compiling': 'Compiling…',
      'toolbar.stop': 'Stop',
      'toolbar.clean': 'Clean cache',
      'toolbar.refresh': 'Refresh',
      'toolbar.env': 'LaTeX environment',
      'toolbar.settings': 'Project settings',
      'toolbar.more': 'More',
      'tree.title': 'Files',
      'tree.new': 'New TeX file',
      'tree.init': 'Create from template',
      'tree.showHidden': 'Show hidden files',
      'tree.showAux': 'Show build artifacts',
      'tree.refresh': 'Reload',
      'tree.empty': 'Empty directory',
      'tree.truncated': 'Large directory: showing the first 500 entries. Use search or Finder for the rest.',
      'tree.loading': 'Loading…',
      'tree.error': 'Failed to load',
      'tree.reveal': 'Reveal in Finder',
      'tree.copyPath': 'Copy relative path',
      'main.ambiguous': 'Several documents could be the main file. Choose the build entry under “Main document”.',
      'editor.empty': 'Choose a file on the left to start editing',
      'editor.emptyHint': 'Or create a section and start from a template.',
      'editor.unsaved': 'Unsaved',
      'editor.saving': 'Saving…',
      'editor.saved': 'Saved',
      'editor.saveFailed': 'Save failed',
      'editor.conflict': 'File changed on disk',
      'editor.conflictHint': 'Reload the disk version, or confirm that your version should overwrite it.',
      'editor.reload': 'Reload',
      'editor.overwrite': 'Overwrite',
      'editor.close': 'Close tab',
      'editor.find': 'Find in file',
      'editor.findNext': 'Next',
      'editor.save': 'Save',
      'editor.line': 'Line',
      'editor.column': 'Col',
      'editor.locatePdf': 'Locate in PDF',
      'editor.copyRef': 'Copy reference',
      'editor.toAgent': 'Send to Writing Agent',
      'editor.agentPromptTitle': 'Act as my Writing Agent and revise this LaTeX.',
      'editor.agentPromptFile': 'File: {path} (lines {from}-{to})',
      'editor.agentPromptSelection': 'Selected source:',
      'editor.agentPromptAsk': 'Request:',
      'editor.copied': 'Reference copied; paste it into the conversation.',
      'editor.locateFailed': 'Locate failed: run a full build and try again.',
      'paper.title': 'Paper PDF',
      'paper.empty': 'Not compiled yet',
      'paper.emptyHint': 'Compile to produce the paper PDF. A failed build keeps the last successful PDF and marks it stale.',
      'paper.stale': 'Showing the last successful PDF; the latest sources have not compiled successfully.',
      'paper.draft': 'Showing a fast-mode draft. Export runs a full build first.',
      'paper.page': 'Page',
      'paper.fit': 'Fit',
      'paper.fitWidth': 'Fit width',
      'paper.fitPage': 'Fit page',
      'paper.reload': 'Reload',
      'paper.export': 'Export PDF',
      'paper.exportFailed': 'Export cancelled: the latest sources did not compile fully, so the old or draft PDF is not exported silently.',
      'paper.openNew': 'Open in new tab',
      'log.title': 'Build output',
      'log.problems': 'Problems',
      'log.raw': 'Log',
      'log.empty': 'No build has run yet.',
      'log.noProblems': 'No errors or warnings.',
      'log.missing': 'Missing dependencies',
      'log.show': 'Show build output',
      'log.hide': 'Hide build output',
      'log.full': 'View full log',
      'log.fixAgent': 'Ask the Writing Agent to fix',
      'log.fixPromptTitle': 'This LaTeX build failed. Act as my Writing Agent and fix it.',
      'log.fixPromptMeta': 'Main document: {main}; engine: {engine}; mode: {mode}',
      'log.fixPromptErrors': 'Errors and warnings:',
      'status.idle': 'Not compiled',
      'status.dirty': 'Sources changed',
      'status.building': 'Compiling',
      'status.success': 'Build succeeded',
      'status.warning': 'Build succeeded with warnings',
      'status.failed': 'Build failed',
      'status.stopped': 'Stopped',
      'status.timeout': 'Build timed out',
      'status.noEnvironment': 'LaTeX missing',
      'env.ready': 'Ready',
      'env.detected': 'Detected, not verified',
      'env.partial': 'Partial',
      'env.missing': 'Not installed',
      'env.failed': 'Check failed',
      'env.title': 'LaTeX environment',
      'env.probe': 'Verify with a minimal build',
      'env.probing': 'Compiling a minimal document…',
      'env.redetect': 'Detect again',
      'env.engines': 'Tools',
      'env.distribution': 'Distribution',
      'env.probeOk': 'The minimal document compiled. Ready to write.',
      'env.probeFailed': 'The minimal document failed to compile. Check the installation or choose another toolchain.',
      'env.installHint': 'No LaTeX was detected. Install BasicTeX or TeX Live, then detect again. dsh-leaf never downloads or reinstalls an environment on its own.',
      'env.partialHint': 'Core engines are available, but bibliography or SyncTeX tools are missing; related features are limited.',
      'env.missingHint': 'Install a local LaTeX distribution first. Editing, file browsing, and chat keep working meanwhile.',
      'env.recheck': 'Detect again',
      'modal.newFile': 'New TeX file',
      'modal.fileName': 'File name',
      'modal.fileNameHint': 'For example sections/related-work.tex',
      'modal.kind': 'File kind',
      'modal.kind.main': 'Main document',
      'modal.kind.section': 'Section file',
      'modal.title': 'Title',
      'modal.folder': 'Folder',
      'modal.create': 'Create',
      'modal.cancel': 'Cancel',
      'modal.init': 'Create project from template',
      'modal.template': 'Template',
      'modal.template.zh': 'Minimal Chinese paper (XeLaTeX)',
      'modal.template.en': 'Minimal English paper (pdfLaTeX)',
      'modal.initHint': 'Adds only missing files; existing code, data, figures, and papers are never overwritten.',
      'modal.initRun': 'Create project',
      'modal.settings': 'Project settings',
      'modal.mainDoc': 'Main document',
      'modal.mainDocHint': 'Builds always start from the main document; opening a section never changes this entry.',
      'modal.buildCwd': 'Build working directory',
      'modal.buildCwdHint': 'Defaults to the main document directory. Leave empty for the default.',
      'modal.enable': 'Enable dsh-leaf in this workspace',
      'modal.enableHint': 'Project files and sessions stay when disabled; re-enable at any time.',
      'modal.save': 'Save settings',
      'modal.close': 'Close',
      'welcome.title': 'Turn this workspace into a LaTeX submission workspace',
      'welcome.body': 'dsh-leaf treats the whole directory as one LaTeX project: experiment code, data, figures, references, and sources stay where they are. Normal conversations keep doing experiments and plots; this view handles writing, compiling, and PDF review.',
      'welcome.enable': 'Enable dsh-leaf',
      'welcome.initZh': 'Create minimal Chinese project',
      'welcome.initEn': 'Create minimal English project',
      'welcome.disabled': 'dsh-leaf is off for this workspace',
      'welcome.disabledBody': 'Project files, figures, and sessions are intact. Re-enabling only restores the writing view; it never creates or overwrites files.',
      'welcome.noWorkspace': 'Choose a workspace to see files',
      'welcome.noWorkspaceBody': 'Open a workspace from the left sidebar to use dsh-leaf.',
      'preview.title': 'Resource preview',
      'preview.image': 'Image',
      'preview.pdf': 'PDF',
      'preview.insert': 'Copy include snippet',
      'preview.inserted': 'Copied an \\includegraphics snippet for the current file.',
      'preview.copyPath': 'Copy relative path',
      'preview.pathCopied': 'Relative path copied.',
      'preview.reveal': 'Reveal in Finder',
      'preview.close': 'Close preview',
      'preview.failed': 'This file cannot be previewed',
      'preview.hint': 'PNG, JPG, SVG, and PDF previews are supported; the paper build output always stays in the right pane.',
      'toast.error': 'Operation failed',
      'toast.busy': 'A build is already running',
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'common.unknown': 'Unknown',
      'common.seconds': 's',
      'common.error': 'Operation failed',
      'common.updated': 'Updated',
      'common.size': 'Size',
      'common.pages': 'Pages',
    }

    /* ------------------------------------------------------------------ */
    /* Styles                                                              */
    /* ------------------------------------------------------------------ */

    const CSS = `
.leaf-root{display:flex;flex-direction:column;height:100%;flex:1;width:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-body,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif);font-size:13px;line-height:1.45}
.leaf-root *{box-sizing:border-box}
.leaf-toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;background:var(--dsw-alias-bg-base);flex:none}
.leaf-toolbar.second{padding-top:0;border-bottom:1px solid var(--dsw-alias-border-l1);gap:10px}
.leaf-brand{display:flex;align-items:center;gap:7px;font-weight:600;letter-spacing:.2px;margin-right:4px}
.leaf-brand svg{display:block}
.leaf-spacer{flex:1}
.leaf-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease}
.leaf-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.leaf-btn:disabled{opacity:.5;cursor:not-allowed}
.leaf-btn.primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-inverted);font-weight:600}
.leaf-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.leaf-btn.ghost{border-color:transparent;background:transparent}
.leaf-btn.ghost:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.leaf-btn.icon{width:28px;padding:0}
.leaf-btn.small{height:24px;padding:0 7px;font-size:11px;border-radius:6px}
.leaf-btn.danger{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.leaf-select{height:28px;max-width:230px;padding:0 7px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.leaf-select:focus-visible,.leaf-btn:focus-visible,.leaf-input:focus-visible,.leaf-textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.leaf-field{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.leaf-chip{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border-radius:999px;font-size:11px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap}
.leaf-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.leaf-chip.ok{color:var(--dsw-alias-label-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l2))}
.leaf-chip.bad{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3)}
.leaf-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:none}
.leaf-dot.ok{background:#2fa86a}.leaf-dot.warn{background:#d99a2b}.leaf-dot.bad{background:#d9534f}.leaf-dot.busy{background:#3a6fd8;animation:leaf-pulse 1s infinite}
@keyframes leaf-pulse{0%,100%{opacity:.35}50%{opacity:1}}
.leaf-body{display:flex;flex:1;min-height:0;min-width:0}
.leaf-tree{display:flex;flex-direction:column;min-width:170px;max-width:420px;background:var(--dsw-alias-bg-layer-1);border-right:1px solid var(--dsw-alias-border-l1);flex:none}
.leaf-pane-head{display:flex;align-items:center;gap:5px;height:34px;padding:0 7px 0 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}
.leaf-pane-head .leaf-spacer{flex:1}
.leaf-tree-scroll{flex:1;overflow:auto;padding:4px 0 16px;min-height:0}
.leaf-row{display:flex;align-items:center;gap:5px;height:24px;padding-right:8px;cursor:pointer;border-radius:5px;margin:0 4px;user-select:none;color:var(--dsw-alias-label-primary);font-size:12.5px;white-space:nowrap}
.leaf-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.leaf-row.active{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-bg-layer-2))}
.leaf-row .leaf-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.leaf-row .leaf-row-actions{display:none;gap:2px}
.leaf-row:hover .leaf-row-actions{display:flex}
.leaf-caret{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .12s ease}
.leaf-caret.open{transform:rotate(90deg)}
.leaf-ext{width:16px;height:16px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex:none;letter-spacing:-.2px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font-family:ui-monospace,Menlo,monospace}
.leaf-ext.tex{background:#e7f2ea;color:#1f7a4d}.leaf-ext.bib{background:#f3eee2;color:#8a6a1f}.leaf-ext.img{background:#e9eefb;color:#3a5fb0}.leaf-ext.pdf{background:#fbe9e7;color:#b0453a}.leaf-ext.code{background:#eef0f4;color:#5a6472}
.leaf-tree-hint{padding:10px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.leaf-editor-col{display:flex;flex-direction:column;flex:1;min-width:280px;min-height:0;background:var(--dsw-alias-bg-base)}
.leaf-tabs{display:flex;align-items:stretch;height:34px;border-bottom:1px solid var(--dsw-alias-border-l1);overflow-x:auto;flex:none;background:var(--dsw-alias-bg-base);scrollbar-width:thin}
.leaf-tab{display:flex;align-items:center;gap:6px;padding:0 8px 0 12px;max-width:220px;border-right:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;position:relative;flex:none}
.leaf-tab.active{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.leaf-tab.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--dsw-alias-brand-primary)}
.leaf-tab .leaf-name{overflow:hidden;text-overflow:ellipsis;max-width:150px}
.leaf-tab .leaf-dirty{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);flex:none}
.leaf-tab .leaf-close{border:0;background:transparent;color:inherit;cursor:pointer;width:18px;height:18px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;opacity:.6;padding:0}
.leaf-tab .leaf-close:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover)}
.leaf-editor-wrap{flex:1;display:flex;flex-direction:column;min-height:0;position:relative}
.leaf-editor{position:relative;flex:1;min-height:0;display:flex;background:var(--dsw-alias-bg-base);overflow:hidden}
.leaf-gutter{width:50px;flex:none;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l1);position:relative;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:12px;line-height:20px;user-select:none}
.leaf-gutter-inner{position:absolute;top:8px;left:0;right:0;will-change:transform}
.leaf-lineno{height:20px;padding:0 8px 0 0;text-align:right;white-space:nowrap}
.leaf-lineno.current{color:var(--dsw-alias-label-primary)}
.leaf-code{position:relative;flex:1;min-width:0;overflow:hidden}
.leaf-highlight{position:absolute;top:8px;left:12px;right:12px;pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:13px;line-height:20px;white-space:pre;will-change:transform;color:var(--dsw-alias-label-primary)}
.leaf-line{position:absolute;left:0;white-space:pre;height:20px}
.leaf-textarea{position:absolute;inset:0;width:100%;height:100%;resize:none;border:0;outline:none;background:transparent;padding:8px 12px;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:13px;line-height:20px;white-space:pre;overflow:auto;color:transparent;caret-color:var(--dsw-alias-label-primary);tab-size:2;scrollbar-width:thin}
.leaf-textarea.composing{color:var(--dsw-alias-label-primary)}
.leaf-textarea::selection{background:var(--dsw-alias-bg-document-selection,#b9d7ff);color:transparent}
.leaf-tok-cmd{color:#8a3fb0}.leaf-tok-comment{color:var(--dsw-alias-label-tertiary);font-style:italic}.leaf-tok-math{color:#1f6fb2}.leaf-tok-brace{color:var(--dsw-alias-label-secondary)}.leaf-tok-env{color:#1f7a4d}.leaf-tok-opt{color:#b06a1f}
body[data-ds-dark-theme] .leaf-tok-cmd{color:#d6a4f0}body[data-ds-dark-theme] .leaf-tok-math{color:#8cc4f5}body[data-ds-dark-theme] .leaf-tok-env{color:#8fd9ae}body[data-ds-dark-theme] .leaf-tok-opt{color:#e8b877}
.leaf-statusbar{display:flex;align-items:center;gap:10px;height:26px;padding:0 10px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11.5px;flex:none;background:var(--dsw-alias-bg-base)}
.leaf-statusbar .leaf-spacer{flex:1}
.leaf-find{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:none}
.leaf-input{height:28px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;min-width:0}
.leaf-input.grow{flex:1}
.leaf-banner{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;flex:none}
.leaf-banner .leaf-spacer{flex:1}
.leaf-banner.warn{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 80%,#d99a2b 20%)}
.leaf-banner.bad{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 80%,#d9534f 20%)}
.leaf-paper{display:flex;flex-direction:column;min-width:240px;max-width:70%;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);flex:0 1 auto}
.leaf-paper-tools{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none;font-size:11px;color:var(--dsw-alias-label-secondary)}
.leaf-paper-body{flex:1;min-height:0;position:relative;background:var(--dsw-alias-bg-layer-2)}
.leaf-paper-body iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.leaf-paper-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}
.leaf-paper-empty strong{color:var(--dsw-alias-label-secondary);font-size:13px;font-weight:600}
.leaf-resizer{width:5px;margin-left:-3px;margin-right:-2px;cursor:col-resize;z-index:3;flex:none;position:relative}
.leaf-resizer:after{content:"";position:absolute;top:0;bottom:0;left:2px;width:1px;background:transparent;transition:background .12s}
.leaf-resizer:hover:after{background:var(--dsw-alias-brand-primary)}
.leaf-log{display:flex;flex-direction:column;flex:none;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-height:0}
.leaf-log-head{display:flex;align-items:center;gap:6px;height:30px;padding:0 8px 0 10px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-secondary);flex:none}
.leaf-log-body{flex:1;min-height:0;overflow:auto;padding:6px 10px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.leaf-problem{display:flex;gap:8px;align-items:flex-start;padding:5px 4px;border-radius:5px;cursor:pointer;font-family:inherit;white-space:normal}
.leaf-problem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.leaf-problem .leaf-where{color:var(--dsw-alias-label-tertiary);flex:none;font-family:ui-monospace,Menlo,monospace;font-size:11px}
.leaf-problem .leaf-msg{flex:1;min-width:0}
.leaf-problem.error .leaf-where{color:#c0463f}
.leaf-preview{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.leaf-preview-body{flex:1;min-height:0;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px;background:var(--dsw-alias-bg-layer-2);background-image:linear-gradient(45deg,var(--dsw-alias-bg-layer-1) 25%,transparent 25%),linear-gradient(-45deg,var(--dsw-alias-bg-layer-1) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--dsw-alias-bg-layer-1) 75%),linear-gradient(-45deg,transparent 75%,var(--dsw-alias-bg-layer-1) 75%);background-size:16px 16px;background-position:0 0,0 8px,8px -8px,-8px 0}
.leaf-preview-body img{max-width:100%;height:auto;box-shadow:0 1px 8px rgba(0,0,0,.14);background:#fff}
.leaf-preview-body iframe{width:100%;height:100%;border:0;background:#fff;min-height:420px}
.leaf-preview-meta{display:flex;align-items:center;gap:8px;padding:5px 10px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none;overflow:hidden}
.leaf-preview-meta .leaf-spacer{flex:1}
.leaf-overlay{position:absolute;inset:0;background:color-mix(in srgb,var(--dsw-alias-bg-base) 70%,transparent);display:flex;align-items:center;justify-content:center;z-index:5;padding:24px}
.leaf-card{max-width:520px;width:100%;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.16)}
.leaf-card h2{margin:0 0 8px;font-size:16px;line-height:1.35}
.leaf-card p{margin:0 0 14px;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.65}
.leaf-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.leaf-modal-mask{position:fixed;inset:0;background:rgba(20,24,28,.35);display:flex;align-items:center;justify-content:center;z-index:60;padding:24px}
.leaf-modal{width:min(520px,100%);max-height:86vh;overflow:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:18px 20px 16px}
.leaf-modal h3{margin:0 0 4px;font-size:15px}
.leaf-modal .leaf-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;margin-bottom:14px}
.leaf-form{display:flex;flex-direction:column;gap:10px}
.leaf-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.leaf-form .leaf-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.leaf-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.leaf-switch{display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary);user-select:none}
.leaf-switch input{display:none}
.leaf-switch .leaf-track{width:30px;height:18px;border-radius:999px;background:var(--dsw-alias-border-l3);position:relative;transition:background .15s}
.leaf-switch .leaf-track:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.leaf-switch input:checked+.leaf-track{background:var(--dsw-alias-brand-primary)}
.leaf-switch input:checked+.leaf-track:after{transform:translateX(12px)}
.leaf-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:var(--dsw-alias-bg-overlay,#222);color:var(--dsw-alias-label-primary-inverted,#fff);padding:7px 12px;border-radius:8px;font-size:12px;z-index:20;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:80%;text-align:center}
.leaf-modal-list{display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px}
.leaf-radio{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:7px;cursor:pointer;border:1px solid transparent}
.leaf-radio:hover{background:var(--dsw-alias-interactive-bg-hover)}
.leaf-radio.selected{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.leaf-radio input{margin-top:3px}
.leaf-radio .leaf-radio-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.leaf-radio .leaf-radio-title{font-size:12.5px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.leaf-radio .leaf-radio-sub{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.leaf-kv{display:grid;grid-template-columns:112px 1fr;gap:6px 10px;font-size:12px}
.leaf-kv dt{color:var(--dsw-alias-label-tertiary)}
.leaf-kv dd{margin:0;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.leaf-kv code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:var(--dsw-alias-bg-layer-2);padding:1px 4px;border-radius:4px}
.leaf-code-block{margin:10px 0 0;padding:8px 10px;background:var(--dsw-alias-bg-layer-2);border-radius:8px;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.5;max-height:180px;overflow:auto;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.leaf-spin{width:12px;height:12px;border-radius:50%;border:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);border-top-color:var(--dsw-alias-brand-primary);animation:leaf-rotate .8s linear infinite;display:inline-block;flex:none}
@keyframes leaf-rotate{to{transform:rotate(360deg)}}
.leaf-muted{color:var(--dsw-alias-label-tertiary)}
.leaf-nowrap{white-space:nowrap}
.leaf-hide{display:none!important}
@media (max-width:900px){.leaf-paper{min-width:200px;max-width:58%}.leaf-tree{min-width:150px}.leaf-editor-col{min-width:220px}}
`

    /* ------------------------------------------------------------------ */
    /* Utilities                                                           */
    /* ------------------------------------------------------------------ */

    const extOf = (name) => {
      const index = String(name).lastIndexOf('.')
      return index <= 0 ? '' : name.slice(index + 1).toLowerCase()
    }
    const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])
    const TEX_EXT = new Set(['tex', 'bib', 'sty', 'cls', 'ltx', 'txt', 'md', 'json', 'csv', 'yml', 'yaml', 'toml', 'cfg', 'ini'])
    const isImage = (name) => IMAGE_EXT.has(extOf(name))
    const isPdf = (name) => extOf(name) === 'pdf'
    const isTex = (name) => ['tex', 'bib', 'sty', 'cls', 'ltx'].includes(extOf(name))

    const basename = (path) => String(path).split('/').pop() || path
    const dirname = (path) => {
      const parts = String(path).split('/')
      parts.pop()
      return parts.join('/')
    }

    const fmtBytes = (bytes) => {
      if (!Number.isFinite(bytes) || bytes <= 0) return '—'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
      return `${(bytes / 1024 / 1024).toFixed(2)} MB`
    }
    const fmtRelative = (ms) => {
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      const delta = Date.now() - ms
      if (delta < 60_000) return '<1m'
      if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m`
      if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h`
      return `${Math.round(delta / 86_400_000)}d`
    }

    function readStored(key, fallback) {
      try {
        const value = window.localStorage.getItem(key)
        return value === null ? fallback : value
      } catch {
        return fallback
      }
    }
    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, String(value))
      } catch {
        // private mode: keep the in-memory value
      }
    }

    /** In-memory per-workspace panel cache so switching to chat and back restores tabs. */
    const panelCache = new Map()

    /** Small observable store shared by the sidebar/context-menu entries and the panel. */
    function createLeafStore() {
      let snapshot = { path: null, file: null, at: 0 }
      const listeners = new Set()
      const source = {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      }
      return {
        source,
        open(path, file = null) {
          snapshot = { path: path ?? snapshot.path, file, at: Date.now() }
          for (const listener of [...listeners]) listener()
        },
      }
    }

    /* ------------------------------------------------------------------ */
    /* API                                                                 */
    /* ------------------------------------------------------------------ */

    class ApiError extends Error {
      constructor(status, payload) {
        super(payload?.message ?? `Request failed (${status})`)
        this.status = status
        this.payload = payload ?? {}
        this.code = payload?.code
      }
    }

    async function api(path, options = {}) {
      const url = new URL(`dsh-leaf${path}`, document.baseURI)
      const init = {
        method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
        credentials: 'same-origin',
        signal: options.signal,
        headers: {},
      }
      if (options.body !== undefined) {
        init.headers['content-type'] = 'application/json'
        init.body = JSON.stringify(options.body)
      }
      const response = await fetch(url, init)
      const text = await response.text()
      let payload = null
      if (text !== '') {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { message: text }
        }
      }
      if (!response.ok) throw new ApiError(response.status, payload)
      return payload
    }

    function workspaceQuery(path, extra = {}) {
      const params = new URLSearchParams({ workspace: path, ...extra })
      return params.toString()
    }

    function assetUrl(workspace, path, version) {
      const url = new URL('dsh-leaf/asset', document.baseURI)
      url.search = workspaceQuery(workspace, { path, v: String(version ?? Date.now()) })
      return url.href
    }

    function pdfUrl(workspace, version) {
      const url = new URL('dsh-leaf/pdf', document.baseURI)
      url.search = workspaceQuery(workspace, { v: String(version ?? Date.now()) })
      return url.href
    }

    function usePersisted(key, fallback) {
      const [value, setValue] = useState(() => readStored(key, fallback))
      const update = useCallback((next) => {
        setValue((previous) => {
          const resolved = typeof next === 'function' ? next(previous) : next
          writeStored(key, typeof resolved === 'boolean' ? (resolved ? '1' : '0') : resolved)
          return resolved
        })
      }, [key])
      return [value, update]
    }

    const boolStored = (raw, fallback) => (raw === '1' ? true : raw === '0' ? false : fallback)

    /* ------------------------------------------------------------------ */
    /* Icons                                                               */
    /* ------------------------------------------------------------------ */

    function LeafMark({ size = 20 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true },
        h('path', {
          d: 'M50.5 9.5c1.6 14.9-2.2 26.2-10.4 33-6.4 5.3-14.6 6.3-22.3 3.2 3.6 1.1 8 .7 12-1.6 8.6-4.9 13.6-14.4 15.2-27.3-3.7 11.2-10.2 19.2-18.4 23-5.6 2.6-11.4 2.3-16.1-.6 2.9 3.9 7.6 6.4 13.3 6.4 12.4 0 24.2-8.4 26.7-36.1Z',
          fill: 'currentColor',
        }),
        h('path', { d: 'M12.6 49.4C24.8 42.7 35.4 31.6 43 17.2', fill: 'none', stroke: 'var(--dsw-alias-bg-base)', strokeWidth: 2.4, strokeLinecap: 'round' }),
      )
    }

    function Chevron({ open }) {
      return h('svg', { width: 12, height: 12, viewBox: '0 0 16 16', 'aria-hidden': true, className: `leaf-caret${open ? ' open' : ''}` },
        h('path', { d: 'M6 3.5 10.5 8 6 12.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function Icon({ name, size = 14 }) {
      const common = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
      switch (name) {
        case 'refresh':
          return h('svg', common, h('path', { d: 'M13 8a5 5 0 1 1-1.5-3.6' }), h('path', { d: 'M13 2.5V5h-2.5' }))
        case 'plus':
          return h('svg', common, h('path', { d: 'M8 3.5v9M3.5 8h9' }))
        case 'file':
          return h('svg', common, h('path', { d: 'M4 1.5h5l3 3v10H4z' }), h('path', { d: 'M9 1.5v3h3' }))
        case 'play':
          return h('svg', common, h('path', { d: 'M4.5 2.8 13 8l-8.5 5.2z', fill: 'currentColor', stroke: 'none' }))
        case 'stop':
          return h('svg', common, h('rect', { x: 4, y: 4, width: 8, height: 8, rx: 1.4, fill: 'currentColor', stroke: 'none' }))
        case 'settings':
          return h('svg', common, h('circle', { cx: 8, cy: 8, r: 2.1 }), h('path', { d: 'M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3' }))
        case 'download':
          return h('svg', common, h('path', { d: 'M8 2v8' }), h('path', { d: 'M4.5 6.5 8 10l3.5-3.5' }), h('path', { d: 'M2.5 13.5h11' }))
        case 'external':
          return h('svg', common, h('path', { d: 'M9 2.5h4.5V7' }), h('path', { d: 'M13.5 2.5 7 9' }), h('path', { d: 'M11.5 9.5v4H2.5v-9h4' }))
        case 'close':
          return h('svg', common, h('path', { d: 'M3.5 3.5l9 9M12.5 3.5l-9 9' }))
        case 'search':
          return h('svg', common, h('circle', { cx: 7, cy: 7, r: 4.2 }), h('path', { d: 'm10.2 10.2 3 3' }))
        case 'image':
          return h('svg', common, h('rect', { x: 2, y: 3, width: 12, height: 10, rx: 1.6 }), h('circle', { cx: 5.6, cy: 6.4, r: 1.1 }), h('path', { d: 'm3 12 3.4-3.4 2.6 2.6 2.2-2.2L14 12' }))
        case 'folder':
          return h('svg', common, h('path', { d: 'M2 4.2c0-.7.5-1.2 1.2-1.2h3l1.3 1.5h4.3c.7 0 1.2.5 1.2 1.2v6.1c0 .7-.5 1.2-1.2 1.2H3.2c-.7 0-1.2-.5-1.2-1.2z' }))
        case 'copy':
          return h('svg', common, h('rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.3 }), h('path', { d: 'M10.5 5.5v-2c0-.55-.45-1-1-1h-6c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h2' }))
        case 'location':
          return h('svg', common, h('path', { d: 'M8 14s4.5-4 4.5-7a4.5 4.5 0 1 0-9 0C3.5 10 8 14 8 14z' }), h('circle', { cx: 8, cy: 7, r: 1.6 }))
        case 'warning':
          return h('svg', common, h('path', { d: 'M8 2 14.5 13.5h-13z' }), h('path', { d: 'M8 6v3.2M8 11.4v.2' }))
        case 'trash':
          return h('svg', common, h('path', { d: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4' }))
        case 'chevron':
          return h('svg', common, h('path', { d: 'M6 3.5 10.5 8 6 12.5' }))
        case 'gear-play':
          return h('svg', common, h('path', { d: 'M2 8h2M12 8h2M8 2v2M8 12v2' }), h('circle', { cx: 8, cy: 8, r: 2.4 }))
        default:
          return h('svg', common, h('circle', { cx: 8, cy: 8, r: 4 }))
      }
    }

    function typeClass(name) {
      const ext = extOf(name)
      if (ext === 'tex' || ext === 'ltx') return 'tex'
      if (ext === 'bib') return 'bib'
      if (IMAGE_EXT.has(ext)) return 'img'
      if (ext === 'pdf') return 'pdf'
      if (['py', 'js', 'ts', 'r', 'm', 'jl', 'sh', 'c', 'cpp', 'h', 'ipynb'].includes(ext)) return 'code'
      return ''
    }

    function TypeBadge({ name }) {
      const ext = extOf(name)
      const label = ext === '' ? '' : ext.slice(0, 3).toUpperCase()
      return h('span', { className: `leaf-ext ${typeClass(name)}`, 'aria-hidden': true }, label || '·')
    }

    /* ------------------------------------------------------------------ */
    /* Small primitives                                                    */
    /* ------------------------------------------------------------------ */

    function Switch({ checked, onChange, label, disabled }) {
      return h('label', { className: 'leaf-switch', title: label },
        h('input', { type: 'checkbox', checked: !!checked, disabled: !!disabled, onChange: (event) => onChange(event.target.checked) }),
        h('span', { className: 'leaf-track', 'aria-hidden': true }),
        label === undefined ? null : h('span', null, label),
      )
    }

    function Modal({ title, subtitle, onClose, children, actions }) {
      const ref = useRef(null)
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onClose()
          }
        }
        window.addEventListener('keydown', onKey, true)
        const timer = setTimeout(() => {
          const target = ref.current?.querySelector('input,select,textarea,button')
          target?.focus?.()
        }, 30)
        return () => {
          window.removeEventListener('keydown', onKey, true)
          clearTimeout(timer)
        }
      }, [onClose])
      return h('div', { className: 'leaf-modal-mask', role: 'presentation', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose() } },
        h('div', { className: 'leaf-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, ref },
          h('h3', null, title),
          subtitle === undefined ? null : h('div', { className: 'leaf-sub' }, subtitle),
          children,
          actions === undefined ? null : h('div', { className: 'leaf-modal-actions' }, actions),
        ),
      )
    }

    function useToast() {
      const [toast, setToast] = useState(null)
      const timer = useRef(null)
      const show = useCallback((text) => {
        setToast(text)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(() => setToast(null), 2600)
      }, [])
      useEffect(() => () => {
        if (timer.current !== null) clearTimeout(timer.current)
      }, [])
      return [toast, show]
    }

    function useResizer(initial, min, max, storageKey, invert = false) {
      const [width, setWidth] = useState(() => {
        const stored = Number(readStored(storageKey, ''))
        return Number.isFinite(stored) && stored > 0 ? Math.min(max, Math.max(min, stored)) : initial
      })
      const state = useRef({ dragging: false, startX: 0, startWidth: 0 })
      const onPointerDown = useCallback((event) => {
        event.preventDefault()
        state.current = { dragging: true, startX: event.clientX, startWidth: width }
        const target = event.currentTarget
        target.setPointerCapture?.(event.pointerId)
        const onMove = (moveEvent) => {
          if (!state.current.dragging) return
          const delta = (moveEvent.clientX - state.current.startX) * (invert ? -1 : 1)
          const next = Math.min(max, Math.max(min, state.current.startWidth + delta))
          state.current.lastWidth = next
          setWidth(next)
        }
        const onUp = () => {
          state.current.dragging = false
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          writeStored(storageKey, Math.round(state.current.lastWidth ?? width))
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
      }, [width, min, max, storageKey, invert])
      const persist = useCallback(() => writeStored(storageKey, Math.round(width)), [width, storageKey])
      return [width, onPointerDown, persist]
    }

    /* ------------------------------------------------------------------ */
    /* LaTeX highlighting                                                  */
    /* ------------------------------------------------------------------ */

    const HIGHLIGHT_RE = /(\\[a-zA-Z@]+\*?)|(%[^\n]*)|(\$[^$]*\$)|(\\begin\{[^}]*\}|\\end\{[^}]*\})|([{}])|(\[[^\]\n]*\])/g

    function tokenizeLine(line) {
      if (line === '') return [{ text: ' ', type: '' }]
      const tokens = []
      let last = 0
      HIGHLIGHT_RE.lastIndex = 0
      let match = HIGHLIGHT_RE.exec(line)
      while (match !== null) {
        if (match.index > last) tokens.push({ text: line.slice(last, match.index), type: '' })
        let type = ''
        if (match[1] !== undefined) type = 'cmd'
        else if (match[2] !== undefined) type = 'comment'
        else if (match[3] !== undefined) type = 'math'
        else if (match[4] !== undefined) type = 'env'
        else if (match[5] !== undefined) type = 'brace'
        else if (match[6] !== undefined) type = 'opt'
        tokens.push({ text: match[0], type })
        last = match.index + match[0].length
        if (type === 'comment') break
        match = HIGHLIGHT_RE.exec(line)
      }
      if (last < line.length) tokens.push({ text: line.slice(last), type: '' })
      return tokens
    }

    /** Virtualized textarea editor with a themed syntax layer. */
    function LatexEditor({ tab, jump, onChange, onSave, onCompile, onCursor, onReference, onSendToAgent, t }) {
      const textareaRef = useRef(null)
      const wrapRef = useRef(null)
      const [scrollTop, setScrollTop] = useState(tab?.scrollTop ?? 0)
      const [scrollLeft, setScrollLeft] = useState(0)
      const [viewport, setViewport] = useState(640)
      const [composition, setComposition] = useState(false)
      const scrollMemory = useRef(new Map())
      const lastPath = useRef(tab?.path)
      const [findOpen, setFindOpen] = useState(false)
      const [findText, setFindText] = useState('')
      const [cursor, setCursor] = useState({ line: 1, column: 1 })
      const content = tab?.content ?? ''
      const lines = useMemo(() => content.split('\n'), [content])
      const lineHeight = 20
      const overscan = 10

      useEffect(() => {
        const node = wrapRef.current
        if (node === null) return undefined
        const observer = new ResizeObserver((entries) => {
          const height = entries[0]?.contentRect.height ?? 600
          setViewport(Math.max(120, height))
        })
        observer.observe(node)
        return () => observer.disconnect()
      }, [])

      useEffect(() => {
        const node = textareaRef.current
        if (node === null) return
        if (lastPath.current !== undefined && lastPath.current !== tab?.path) {
          scrollMemory.current.set(lastPath.current, scrollTop)
        }
        lastPath.current = tab?.path
        const saved = tab?.path === undefined ? 0 : (scrollMemory.current.get(tab.path) ?? 0)
        node.scrollTop = saved
        node.scrollLeft = 0
        setScrollTop(saved)
        setScrollLeft(0)
      }, [tab?.path])

      useEffect(() => {
        if (jump === null || jump === undefined || tab === undefined || jump.path !== tab.path) return
        const node = textareaRef.current
        if (node === null) return
        const lines = tab.content.split('\n')
        const index = Math.max(0, Math.min(lines.length - 1, Number(jump.line ?? 1) - 1))
        let offset = 0
        for (let cursor = 0; cursor < index; cursor += 1) offset += lines[cursor].length + 1
        node.focus()
        node.setSelectionRange(offset, offset + lines[index].length)
        const top = Math.max(0, index * lineHeight - 80)
        node.scrollTop = top
        setScrollTop(top)
        updateCursor()
      }, [jump?.at, tab?.path])

      const updateCursor = useCallback(() => {
        const node = textareaRef.current
        if (node === null || tab === undefined) return
        const before = tab.content.slice(0, node.selectionStart)
        const line = before.split('\n').length
        const column = before.length - before.lastIndexOf('\n')
        setCursor({ line, column })
        onCursor?.({ line, column })
      }, [tab?.content, onCursor])

      useEffect(() => {
        updateCursor()
      }, [tab?.path])

      const insertText = (text) => {
        const node = textareaRef.current
        if (node === null || tab === undefined) return
        const start = node.selectionStart
        const end = node.selectionEnd
        const next = tab.content.slice(0, start) + text + tab.content.slice(end)
        onChange(next, { start: start + text.length, end: start + text.length })
        const caret = start + text.length
        requestAnimationFrame(() => {
          node.setSelectionRange(caret, caret)
          updateCursor()
        })
      }

      const findNext = () => {
        if (findText === '') return
        const node = textareaRef.current
        if (node === null || tab === undefined) return
        const from = node.selectionEnd
        let index = tab.content.indexOf(findText, from)
        if (index === -1) index = tab.content.indexOf(findText)
        if (index === -1) return
        node.focus()
        node.setSelectionRange(index, index + findText.length)
        const line = tab.content.slice(0, index).split('\n').length
        node.scrollTop = Math.max(0, (line - 4) * lineHeight)
        updateCursor()
      }

      const onKeyDown = (event) => {
        const mod = event.metaKey || event.ctrlKey
        if (mod && event.key.toLowerCase() === 's') {
          event.preventDefault()
          onSave?.()
          return
        }
        if (mod && event.key === 'Enter') {
          event.preventDefault()
          onCompile?.()
          return
        }
        if (mod && event.key.toLowerCase() === 'f') {
          event.preventDefault()
          setFindOpen(true)
          return
        }
        if (event.key === 'Escape' && findOpen) {
          setFindOpen(false)
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          insertText('  ')
        }
      }

      const start = Math.max(0, Math.floor(scrollTop / lineHeight) - overscan)
      const end = Math.min(lines.length, start + Math.ceil(viewport / lineHeight) + overscan * 2)
      const visible = []
      for (let index = start; index < end; index += 1) {
        const tokens = tokenizeLine(lines[index])
        visible.push(h('div', { key: index, className: 'leaf-line', style: { top: `${index * lineHeight}px` } },
          tokens.map((token, tokenIndex) => token.type === ''
            ? token.text
            : h('span', { key: tokenIndex, className: `leaf-tok-${token.type}` }, token.text)),
        ))
      }

      const gutter = []
      for (let index = start; index < end; index += 1) {
        gutter.push(h('div', {
          key: index,
          className: `leaf-lineno${cursor.line === index + 1 ? ' current' : ''}`,
        }, String(index + 1)))
      }

      return h('div', { className: 'leaf-editor-wrap' },
        findOpen ? h('div', { className: 'leaf-find' },
          h('input', {
            className: 'leaf-input grow',
            value: findText,
            autoFocus: true,
            placeholder: t('editor.find'),
            onChange: (event) => setFindText(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                findNext()
              }
            },
          }),
          h('button', { type: 'button', className: 'leaf-btn small', onClick: findNext }, t('editor.findNext')),
          h('button', { type: 'button', className: 'leaf-btn small ghost', onClick: () => setFindOpen(false) }, h(Icon, { name: 'close' })),
        ) : null,
        h('div', { className: 'leaf-editor' },
          h('div', { className: 'leaf-gutter' }, h('div', { className: 'leaf-gutter-inner', style: { transform: `translateY(${-scrollTop}px)` } }, gutter)),
          h('div', { className: 'leaf-code', ref: wrapRef },
            h('div', {
              className: 'leaf-highlight',
              style: { transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`, height: `${lines.length * lineHeight}px` },
            }, visible),
            h('textarea', {
              ref: textareaRef,
              className: `leaf-textarea${composition ? ' composing' : ''}`,
              value: content,
              spellCheck: false,
              autoCapitalize: 'off',
              autoCorrect: 'off',
              wrap: 'off',
              'aria-label': tab?.name ?? 'LaTeX source',
              onChange: (event) => onChange(event.target.value),
              onScroll: (event) => {
                setScrollTop(event.target.scrollTop)
                setScrollLeft(event.target.scrollLeft)
                if (tab?.path !== undefined) scrollMemory.current.set(tab.path, event.target.scrollTop)
              },
              onKeyDown,
              onKeyUp: updateCursor,
              onClick: updateCursor,
              onSelect: updateCursor,
              onCompositionStart: () => setComposition(true),
              onCompositionEnd: (event) => {
                setComposition(false)
                onChange(event.target.value)
              },
            }),
          ),
        ),
        h('div', { className: 'leaf-statusbar' },
          h('span', null, tab === undefined ? '' : `${t('editor.line')} ${cursor.line}, ${t('editor.column')} ${cursor.column}`),
          h('span', null, `${lines.length} ${t('editor.line')}`),
          h('span', { className: 'leaf-spacer' }),
          h('button', {
            type: 'button',
            className: 'leaf-btn small ghost',
            title: t('editor.copyRef'),
            onClick: () => {
              const node = textareaRef.current
              if (node === null || tab === undefined) return
              const selected = node.value.slice(node.selectionStart, node.selectionEnd)
              const before = node.value.slice(0, node.selectionStart)
              const fromLine = before.split('\n').length
              const toLine = fromLine + (selected.split('\n').length - 1)
              onReference?.({ path: tab.path, fromLine, toLine, text: selected })
            },
          }, h(Icon, { name: 'copy' }), t('editor.copyRef')),
          h('button', {
            type: 'button',
            className: 'leaf-btn small ghost',
            title: t('editor.toAgent'),
            onClick: () => {
              const node = textareaRef.current
              if (node === null || tab === undefined) return
              const selected = node.value.slice(node.selectionStart, node.selectionEnd)
              const before = node.value.slice(0, node.selectionStart)
              const fromLine = before.split('\n').length
              const toLine = fromLine + (selected.split('\n').length - 1)
              onSendToAgent?.({ path: tab.path, fromLine, toLine, text: selected })
            },
          }, h(LeafMark, { size: 12 }), t('editor.toAgent')),
          h('button', {
            type: 'button',
            className: 'leaf-btn small ghost',
            title: t('editor.locatePdf'),
            onClick: () => onCursor?.({ line: cursor.line, locate: true }),
          }, h(Icon, { name: 'location' }), t('editor.locatePdf')),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* File tree                                                           */
    /* ------------------------------------------------------------------ */

    function TreeRow({ entry, depth, expanded, activePath, onToggle, onOpen, t, onReveal }) {
      const isDir = entry.type === 'directory'
      return h('div', {
        className: `leaf-row${activePath === entry.path ? ' active' : ''}`,
        style: { paddingLeft: `${6 + depth * 13}px` },
        title: entry.path,
        onClick: () => (isDir ? onToggle(entry.path) : onOpen(entry)),
      },
        isDir ? h(Chevron, { open: expanded.has(entry.path) }) : h('span', { style: { width: 14, flex: 'none' } }),
        isDir ? h(Icon, { name: 'folder' }) : h(TypeBadge, { name: entry.name }),
        h('span', { className: 'leaf-name' }, entry.name),
      )
    }

    function FileTree({ dirs, expanded, loading, activePath, onToggle, onOpen, onLoad, t, showAux, showHidden, onToggleAux, onToggleHidden, onNewFile, onInit, onRefresh, onReveal, width }) {
      const renderDir = (dirPath, depth) => {
        const bucket = dirs[dirPath]
        if (bucket === undefined) return null
        if (bucket.status === 'error') {
          return [h('div', { key: `${dirPath}:error`, className: 'leaf-tree-hint' }, t('tree.error'), ' ', h('button', { type: 'button', className: 'leaf-btn small', onClick: () => onLoad(dirPath) }, t('common.retry')))]
        }
        const rows = []
        for (const entry of bucket.entries ?? []) {
          rows.push(h(TreeRow, {
            key: entry.path,
            entry,
            depth,
            expanded,
            activePath,
            onToggle,
            onOpen,
            t,
            onReveal,
          }))
          if (entry.type === 'directory' && expanded.has(entry.path)) {
            const child = renderDir(entry.path, depth + 1)
            if (child !== null) rows.push(h('div', { key: `${entry.path}:children` }, child))
          }
        }
        if (bucket.status === 'loading' && (bucket.entries ?? []).length === 0) {
          rows.push(h('div', { key: `${dirPath}:loading`, className: 'leaf-tree-hint' }, t('tree.loading')))
        }
        if (bucket.status === 'ready' && (bucket.entries ?? []).length === 0) {
          rows.push(h('div', { key: `${dirPath}:empty`, className: 'leaf-tree-hint' }, t('tree.empty')))
        }
        if (bucket.truncated === true) {
          rows.push(h('div', { key: `${dirPath}:truncated`, className: 'leaf-tree-hint' }, t('tree.truncated')))
        }
        return rows
      }
      return h('div', { className: 'leaf-tree', style: width === undefined ? undefined : { width } },
        h('div', { className: 'leaf-pane-head' },
          h(Icon, { name: 'folder', size: 13 }),
          h('span', null, t('tree.title')),
          h('span', { className: 'leaf-spacer' }),
          h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('tree.new'), onClick: onNewFile }, h(Icon, { name: 'plus' })),
          h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('tree.init'), onClick: onInit }, h(Icon, { name: 'file' })),
          h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('tree.refresh'), onClick: onRefresh }, h(Icon, { name: 'refresh' })),
        ),
        h('div', { className: 'leaf-tree-scroll' },
          loading ? h('div', { className: 'leaf-tree-hint' }, t('common.loading')) : renderDir('', 0),
        ),
        h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l1)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 'none' } },
          h(Switch, { checked: showAux, onChange: onToggleAux, label: t('tree.showAux') }),
          h(Switch, { checked: showHidden, onChange: onToggleHidden, label: t('tree.showHidden') }),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Paper pane                                                          */
    /* ------------------------------------------------------------------ */

    function PaperPane({ url, stale, draft, page, fit, onPage, onFit, onReload, onExport, t, style, onResizeStart }) {
      const hash = `#page=${page}&zoom=${fit === 'page' ? 'page-fit' : 'page-width'}&toolbar=1&navpanes=0`
      return h('div', { className: 'leaf-paper', style },
        h('div', { className: 'leaf-pane-head' }, h(Icon, { name: 'file', size: 13 }), h('span', null, t('paper.title')), h('span', { className: 'leaf-spacer' }),
          h('span', { className: 'leaf-muted', style: { fontWeight: 400 } }, page)),
        h('div', { className: 'leaf-paper-tools' },
          h('span', null, t('paper.page')),
          h('input', {
            className: 'leaf-input',
            style: { width: 46, height: 22, padding: '0 5px' },
            value: page,
            inputMode: 'numeric',
            onChange: (event) => onPage(event.target.value.replace(/[^0-9]/g, '')),
          }),
          h('select', { className: 'leaf-select', style: { height: 22, fontSize: 11 }, value: fit, onChange: (event) => onFit(event.target.value) },
            h('option', { value: 'width' }, t('paper.fitWidth')),
            h('option', { value: 'page' }, t('paper.fitPage')),
          ),
          h('span', { className: 'leaf-spacer' }),
          url === null ? null : h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('paper.reload'), onClick: onReload }, h(Icon, { name: 'refresh' })),
          url === null ? null : h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('paper.export'), onClick: onExport }, h(Icon, { name: 'download' })),
          url === null ? null : h('a', { className: 'leaf-btn icon small ghost', title: t('paper.openNew'), href: url, target: '_blank', rel: 'noreferrer' }, h(Icon, { name: 'external' })),
        ),
        stale ? h('div', { className: 'leaf-banner warn' }, h(Icon, { name: 'warning' }), h('span', null, t('paper.stale'))) : null,
        draft === true && stale === false ? h('div', { className: 'leaf-banner' }, h(Icon, { name: 'warning' }), h('span', null, t('paper.draft'))) : null,
        h('div', { className: 'leaf-paper-body' },
          url === null
            ? h('div', { className: 'leaf-paper-empty' }, h(LeafMark, { size: 30 }), h('strong', null, t('paper.empty')), h('span', null, t('paper.emptyHint')))
            : h('iframe', { title: t('paper.title'), src: `${url}${hash}`, key: `${url}${hash}` }),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Preview pane                                                        */
    /* ------------------------------------------------------------------ */

    function PreviewPane({ preview, workspace, onClose, onToast, t }) {
      const url = preview === null ? null : assetUrl(workspace, preview.path, preview.mtime)
      const copy = async (text) => {
        try {
          await navigator.clipboard.writeText(text)
          return true
        } catch {
          return false
        }
      }
      if (preview === null) return null
      return h('div', { className: 'leaf-preview' },
        h('div', { className: 'leaf-pane-head' },
          h(Icon, { name: preview.kind === 'image' ? 'image' : 'file', size: 13 }),
          h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, preview.name),
          h('span', { className: 'leaf-spacer' }),
          preview.kind === 'image' ? h('button', {
            type: 'button',
            className: 'leaf-btn small ghost',
            onClick: async () => {
              const snippet = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${preview.path}}\n  \\caption{}\n  \\label{fig:${basename(preview.name).replace(/\.[^.]+$/, '')}}\n\\end{figure}`
              if (await copy(snippet)) onToast?.(t('preview.inserted'))
            },
          }, h(Icon, { name: 'copy' }), t('preview.insert')) : null,
          h('button', {
            type: 'button',
            className: 'leaf-btn small ghost',
            onClick: async () => {
              if (await copy(preview.path)) onToast?.(t('preview.pathCopied'))
            },
          }, h(Icon, { name: 'copy' }), t('preview.copyPath')),
          h('button', { type: 'button', className: 'leaf-btn small ghost', title: t('preview.reveal'), onClick: () => api('/reveal', { body: { workspace, path: preview.path } }).catch(() => {}) }, h(Icon, { name: 'location' })),
          h('button', { type: 'button', className: 'leaf-btn icon small ghost', title: t('preview.close'), onClick: onClose }, h(Icon, { name: 'close' })),
        ),
        h('div', { className: 'leaf-preview-body' },
          preview.kind === 'image'
            ? h('img', { src: url, alt: preview.name })
            : h('iframe', { src: url, title: preview.name }),
        ),
        h('div', { className: 'leaf-preview-meta' },
          h('span', null, preview.path),
          h('span', { className: 'leaf-spacer' }),
          h('span', null, `${t('common.size')} ${fmtBytes(preview.size)}`),
          h('span', null, `${t('common.updated')} ${fmtRelative(preview.mtime)}`),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Build log                                                          */
    /* ------------------------------------------------------------------ */

    function LogPane({ open, receipt, onToggle, onOpenProblem, onFullLog, onFixWithAgent, t, height }) {
      const [tab, setTab] = useState('problems')
      const errors = receipt?.errors ?? []
      const warnings = receipt?.warnings ?? []
      const missing = receipt?.missing ?? []
      const problems = [
        ...errors.map((error, index) => ({ ...error, key: `e${index}`, severity: 'error' })),
        ...warnings.map((warning, index) => ({ key: `w${index}`, severity: 'warning', message: warning, file: null, line: null })),
      ]
      return h('div', { className: 'leaf-log', style: open ? { height } : { height: 30 } },
        h('div', { className: 'leaf-log-head' },
          h('button', { type: 'button', className: 'leaf-btn small ghost', onClick: onToggle, title: open ? t('log.hide') : t('log.show') }, h(Chevron, { open })),
          h('span', null, t('log.title')),
          receipt === null ? null : h('span', { className: 'leaf-muted' }, `· ${receipt.status} · ${((receipt.durationMs ?? 0) / 1000).toFixed(1)}${t('common.seconds')}`),
          h('span', { className: 'leaf-spacer' }),
          open ? h('button', { type: 'button', className: `leaf-btn small ${tab === 'problems' ? '' : 'ghost'}`, onClick: () => setTab('problems') }, `${t('log.problems')} ${problems.length}`) : null,
          open ? h('button', { type: 'button', className: `leaf-btn small ${tab === 'raw' ? '' : 'ghost'}`, onClick: () => setTab('raw') }, t('log.raw')) : null,
          open ? h('button', { type: 'button', className: 'leaf-btn small ghost', onClick: onFullLog }, t('log.full')) : null,
          open && receipt !== null && (receipt.errors?.length > 0 || receipt.missing?.length > 0)
            ? h('button', { type: 'button', className: 'leaf-btn small', onClick: onFixWithAgent }, t('log.fixAgent'))
            : null,
        ),
        open ? h('div', { className: 'leaf-log-body' },
          receipt === null
            ? h('div', { className: 'leaf-muted' }, t('log.empty'))
            : tab === 'raw'
              ? h('div', null, receipt.logTail || t('log.empty'))
              : h('div', null,
                  problems.length === 0 && missing.length === 0 ? h('div', { className: 'leaf-muted' }, t('log.noProblems')) : null,
                  problems.map((problem) => h('div', {
                    key: problem.key,
                    className: `leaf-problem ${problem.severity}`,
                    onClick: () => onOpenProblem(problem),
                  },
                    h('span', { className: 'leaf-where' }, problem.file === null || problem.file === undefined ? (problem.severity === 'warning' ? 'warning' : 'build') : `${problem.file}${problem.line === null || problem.line === undefined ? '' : `:${problem.line}`}`),
                    h('span', { className: 'leaf-msg' }, problem.message),
                  )),
                  missing.length === 0 ? null : h('div', { style: { marginTop: 6 } },
                    h('div', { className: 'leaf-muted', style: { marginBottom: 4 } }, t('log.missing')),
                    missing.map((item) => h('div', { key: item.name, className: 'leaf-problem error' }, h('span', { className: 'leaf-where' }, item.name), h('span', { className: 'leaf-msg' }, item.hint))),
                  ),
                )
        ) : null,
      )
    }

    /* ------------------------------------------------------------------ */
    /* Main panel                                                          */
    /* ------------------------------------------------------------------ */

    function LeafPanel(props) {
      const { useLeaf, t, openPanel } = props
      const openRequest = useLeaf((snapshot) => snapshot)
      const workspaces = props.useWorkspaces((snapshot) => snapshot.items)
      const activeSessionCwd = props.useSessions((snapshot) => {
        const session = Object.values(snapshot.byId ?? {}).find((item) => (item.retainedBy?.mainView ?? 0) > 0)
        return session?.cwd ?? null
      })
      const [activePath, setActivePath] = useState(() => readStored(STORAGE.workspace, ''))
      const [state, setState] = useState(null)
      const [loading, setLoading] = useState(false)
      const [loadError, setLoadError] = useState(null)
      const [dirs, setDirs] = useState({})
      const [treeLoading, setTreeLoading] = useState(false)
      const [expanded, setExpanded] = useState(() => new Set())
      const [showAuxRaw, setShowAuxRaw] = usePersisted(STORAGE.showAux, false)
      const [showHiddenRaw, setShowHiddenRaw] = usePersisted(STORAGE.showHidden, false)
      const showAux = boolStored(showAuxRaw, false)
      const showHidden = boolStored(showHiddenRaw, false)
      const [tabs, setTabs] = useState([])
      const [activeTabPath, setActiveTabPath] = useState(null)
      const [preview, setPreview] = useState(null)
      const [build, setBuild] = useState({ status: 'idle', receipt: null })
      const [savedAt, setSavedAt] = useState(0)
      const [logOpenRaw, setLogOpenRaw] = usePersisted(STORAGE.logOpen, true)
      const logOpen = boolStored(logOpenRaw, true)
      const [modal, setModal] = useState(null)
      const [pdfPage, setPdfPage] = useState('1')
      const [pdfFit, setPdfFit] = useState('width')
      const [pdfReloadKey, setPdfReloadKey] = useState(0)
      const [jump, setJump] = useState(null)
      const [toast, showToast] = useToast()
      const [treeWidth, onTreeResize, persistTree] = useResizer(224, 170, 420, STORAGE.treeWidth)
      const [paperWidth, onPaperResize] = useResizer(540, 260, 1000, STORAGE.paperWidth, true)
      const [saving, setSaving] = useState(null)
      const alive = useRef(true)
      const viewRef = useRef({ tabs, activeTabPath, expanded, preview, pdfPage })
      const tabsRef = useRef(tabs)
      const expandedRef = useRef(expanded)
      const stateRef = useRef(state)
      const buildingRef = useRef(false)
      const treeInFlight = useRef(new Set())
      const dirsRef = useRef(dirs)
      const saveTimers = useRef(new Map())
      const compileTimer = useRef(null)

      tabsRef.current = tabs
      stateRef.current = state
      dirsRef.current = dirs
      expandedRef.current = expanded
      viewRef.current = { tabs, activeTabPath, expanded, preview, pdfPage }
      useEffect(() => () => { alive.current = false }, [])

      const workspaceItems = workspaces ?? []
      const activeWorkspace = workspaceItems.find((item) => item.path === activePath) ?? null
      const redetectEnv = useCallback(async () => {
        try {
          const environmentPayload = await api('/env?force=1')
          if (!alive.current) return
          setState((previous) => (previous === null ? previous : { ...previous, environment: environmentPayload }))
          setModal((previous) => (previous?.kind === 'env' ? { kind: 'env', environment: environmentPayload } : previous))
        } catch (error) {
          showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [t])

      const project = state?.project ?? null
      const environment = state?.environment ?? null
      const receipt = build.receipt ?? null

      useEffect(() => {
        if (openRequest?.path !== null && openRequest?.path !== undefined) {
          setActivePath(openRequest.path)
        }
      }, [openRequest?.at])

      useEffect(() => {
        if (workspaceItems.length === 0) return
        const valid = workspaceItems.some((item) => item.path === activePath)
        if (!valid) setActivePath(workspaceItems[0].path)
      }, [workspaceItems.map((item) => item.path).join('|')])

      // Follow the workspace of the session the user switched to in the sidebar.
      // A workspace picked inside the panel stays until that session changes.
      useEffect(() => {
        if (activeSessionCwd === null || activeSessionCwd === undefined) return
        const match = workspaceItems.find((item) => activeSessionCwd === item.path
          || activeSessionCwd.startsWith(`${item.path}/`))
        if (match !== undefined && match.path !== activePath) setActivePath(match.path)
      }, [activeSessionCwd, workspaceItems.map((item) => item.path).join('|')])

      useEffect(() => {
        if (activePath !== '') writeStored(STORAGE.workspace, activePath)
      }, [activePath])

      const workspacePath = activeWorkspace?.path ?? (activePath !== '' ? activePath : null)

      const refreshState = useCallback(async (options = {}) => {
        if (workspacePath === null) return null
        if (!options.quiet) setLoading(true)
        try {
          const payload = await api(`/state?${workspaceQuery(workspacePath)}`, { signal: options.signal })
          if (!alive.current) return null
          const serialized = JSON.stringify(payload)
          setState((previous) => (previous !== null && JSON.stringify(previous) === serialized ? previous : payload))
          setBuild((previous) => {
            const running = payload.buildQueue?.running === true || payload.buildQueue?.queued === true
            if (running) return previous.status === 'building' ? previous : { status: 'building', receipt: previous.receipt }
            if (previous.status === 'building') {
              return { status: payload.project?.lastBuild?.status ?? 'idle', receipt: previous.receipt }
            }
            if (previous.receipt === null && previous.status === 'idle' && payload.project?.lastBuild !== null && payload.project?.lastBuild !== undefined) {
              return { status: payload.project.lastBuild.status ?? 'idle', receipt: null }
            }
            return previous
          })
          setLoadError(null)
          return payload
        } catch (error) {
          if (!alive.current) return null
          if (error.name === 'AbortError') return null
          setLoadError(error.message)
          return null
        } finally {
          if (alive.current && !options.quiet) setLoading(false)
        }
      }, [workspacePath])

      useEffect(() => {
        if (workspacePath === null) {
          setState(null)
          return undefined
        }
        const controller = new AbortController()
        const cached = panelCache.get(workspacePath)
        setTabs(cached?.tabs ?? [])
        setActiveTabPath(cached?.activeTabPath ?? null)
        setPreview(cached?.preview ?? null)
        setExpanded(new Set(cached?.expanded ?? []))
        setPdfPage(cached?.pdfPage ?? '1')
        setDirs({})
        setBuild({ status: 'idle', receipt: null })
        refreshState({ signal: controller.signal })
        return () => {
          controller.abort()
          panelCache.set(workspacePath, { ...viewRef.current, expanded: [...viewRef.current.expanded] })
        }
      }, [workspacePath])

      const loadDir = useCallback(async (dirPath, options = {}) => {
        if (workspacePath === null) return
        const key = `${workspacePath}::${dirPath}::${showAux}::${showHidden}`
        if (treeInFlight.current.has(key)) return
        treeInFlight.current.add(key)
        setDirs((previous) => (previous[dirPath]?.entries !== undefined
          ? previous
          : { ...previous, [dirPath]: { ...(previous[dirPath] ?? {}), status: 'loading' } }))
        try {
          const query = workspaceQuery(workspacePath, { dir: dirPath, aux: showAux ? '1' : '0', hidden: showHidden ? '1' : '0' })
          const payload = await api(`/tree?${query}`, { signal: options.signal })
          if (!alive.current) return
          setDirs((previous) => {
            const before = previous[dirPath]
            const same = before?.entries !== undefined && JSON.stringify(before.entries) === JSON.stringify(payload.entries)
            if (same && before.status === 'ready') return previous
            return { ...previous, [dirPath]: { status: 'ready', entries: payload.entries, truncated: payload.truncated === true } }
          })
        } catch (error) {
          if (error.name === 'AbortError') return
          if (!alive.current) return
          setDirs((previous) => ({ ...previous, [dirPath]: { status: 'error', entries: previous[dirPath]?.entries ?? [], message: error.message } }))
        } finally {
          treeInFlight.current.delete(key)
        }
      }, [workspacePath, showAux, showHidden])

      useEffect(() => {
        if (workspacePath === null) return
        setTreeLoading(true)
        setDirs({})
        loadDir('').finally(() => {
          if (alive.current) setTreeLoading(false)
        })
        for (const dir of expandedRef.current) loadDir(dir)
      }, [workspacePath, showAux, showHidden, loadDir])

      // Poll only the directories that are currently visible/expanded. This keeps
      // external writes and agent-produced figures visible without scanning the tree.
      useEffect(() => {
        if (workspacePath === null) return undefined
        let tick = 0
        const timer = setInterval(() => {
          tick += 1
          const openDirs = ['', ...[...expanded].filter((path) => dirsRef.current[path] !== undefined)]
          for (const dir of openDirs) loadDir(dir, { quiet: true })
          // Project state changes more slowly than the tree; refresh it every other tick.
          if (tick % 2 === 0) refreshState({ quiet: true })
        }, 1500)
        return () => clearInterval(timer)
      }, [workspacePath, expanded, dirs, loadDir, refreshState])

      // Follow external writes to the previewed resource: the directory poll
      // carries a new mtime, which bumps the asset URL and reloads the image/PDF.
      useEffect(() => {
        if (preview === null) return
        const directory = dirname(preview.path)
        const entry = (dirs[directory]?.entries ?? []).find((candidate) => candidate.path === preview.path)
        if (entry !== undefined && (entry.mtime !== preview.mtime || entry.size !== preview.size)) {
          setPreview((current) => (current !== null && current.path === entry.path
            ? { ...current, mtime: entry.mtime, size: entry.size }
            : current))
        }
      }, [dirs, preview])

      const toggleDir = useCallback((dirPath) => {
        setExpanded((previous) => {
          const next = new Set(previous)
          if (next.has(dirPath)) next.delete(dirPath)
          else {
            next.add(dirPath)
            if (dirs[dirPath] === undefined) loadDir(dirPath)
          }
          return next
        })
      }, [dirs, loadDir])

      const activeTab = tabs.find((tab) => tab.path === activeTabPath) ?? null

      const openFile = useCallback(async (entry) => {
        if (workspacePath === null) return
        if (isImage(entry.name) || isPdf(entry.name)) {
          setPreview({ path: entry.path, name: entry.name, kind: isPdf(entry.name) ? 'pdf' : 'image', mtime: entry.mtime, size: entry.size })
          return
        }
        if (!TEX_EXT.has(entry.extension)) {
          setPreview({ path: entry.path, name: entry.name, kind: 'file', mtime: entry.mtime, size: entry.size })
          return
        }
        const existing = tabsRef.current.find((tab) => tab.path === entry.path)
        if (existing !== undefined) {
          setActiveTabPath(entry.path)
          return
        }
        try {
          const payload = await api(`/file?${workspaceQuery(workspacePath, { path: entry.path })}`)
          if (!alive.current) return
          const tab = {
            path: payload.path,
            name: basename(payload.path),
            content: payload.content,
            savedContent: payload.content,
            mtime: payload.mtime,
            size: payload.size,
            scrollTop: 0,
          }
          setTabs((previous) => [...previous, tab])
          setActiveTabPath(tab.path)
          setPreview(null)
        } catch (error) {
          if (error.code === 'binary' || error.code === 'too-large') {
            setPreview({ path: entry.path, name: entry.name, kind: 'file', mtime: entry.mtime, size: entry.size })
          } else showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [workspacePath])

      // A file action from the host's right-sidebar tree opens the workspace and
      // then the requested file in this panel.
      useEffect(() => {
        if (workspacePath === null || openRequest?.file === null || openRequest?.file === undefined) return
        if (openRequest.path !== null && openRequest.path !== undefined && openRequest.path !== workspacePath) return
        const file = openRequest.file
        openFile({ path: file, name: basename(file), extension: extOf(file), mtime: 0, size: 0 })
      }, [workspacePath, openRequest?.at])

      const updateTab = useCallback((path, content) => {
        setTabs((previous) => previous.map((tab) => (tab.path === path ? { ...tab, content } : tab)))
      }, [])

      const saveTab = useCallback(async (path, options = {}) => {
        const tab = tabsRef.current.find((item) => item.path === path)
        if (tab === undefined || workspacePath === null) return false
        if (!options.force && tab.content === tab.savedContent && tab.mtime !== 0) return true
        setSaving(path)
        try {
          const receipt = await api('/file', {
            body: {
              workspace: workspacePath,
              path,
              content: tab.content,
              expectedMtime: options.force ? null : tab.mtime,
            },
          })
          if (!alive.current) return true
          setTabs((previous) => previous.map((item) => (item.path === path ? { ...item, mtime: receipt.mtime, size: receipt.size, savedContent: item.content } : item)))
          setSaving(null)
          if (options.silent !== true) setSavedAt(Date.now())
          return true
        } catch (error) {
          if (!alive.current) return false
          setSaving(null)
          if (error.code === 'conflict') {
            setTabs((previous) => previous.map((item) => (item.path === path ? { ...item, conflict: true } : item)))
          } else {
            showToast(`${t('editor.saveFailed')}: ${error.message}`)
          }
          return false
        }
      }, [workspacePath])

      // Auto save 1.2 s after the last keystroke, matching the writing-view target.
      useEffect(() => {
        const dirty = tabs.filter((tab) => tab.content !== tab.savedContent)
        if (dirty.length === 0) return undefined
        const timers = dirty.map((tab) => setTimeout(() => saveTab(tab.path), 1200))
        return () => timers.forEach((timer) => clearTimeout(timer))
      }, [tabs, saveTab])

      const dirtyCount = tabs.filter((tab) => tab.content !== tab.savedContent).length

      const compile = useCallback(async (options = {}) => {
        if (workspacePath === null) return
        if (buildingRef.current) {
          showToast(t('toast.busy'))
          return
        }
        buildingRef.current = true
        setBuild((previous) => ({ ...previous, status: 'building' }))
        try {
          const saves = await Promise.all(tabsRef.current
            .filter((tab) => tab.content !== tab.savedContent)
            .map((tab) => saveTab(tab.path, { silent: true })))
          if (saves.includes(false)) {
            showToast(t('editor.saveFailed'))
            return null
          }
          const receipt = await api('/compile', {
            body: {
              workspace: workspacePath,
              mode: options.mode,
              engine: options.engine,
              mainDocument: options.mainDocument,
              clean: options.clean === true,
            },
          })
          if (!alive.current) return
          setBuild({ status: receipt.status, receipt })
          if (receipt.state !== undefined) setState(receipt.state)
          setPdfPage('1')
          setPdfReloadKey(Date.now())
          if (receipt.status === 'success' || receipt.status === 'warning') showToast(`${t('status.success')} · ${(receipt.durationMs / 1000).toFixed(1)}${t('common.seconds')}`)
          return receipt
        } catch (error) {
          if (!alive.current) return
          setBuild({ status: 'failed', receipt: { status: 'failed', errors: [{ message: error.message }], warnings: [], logTail: error.message } })
          showToast(`${t('toast.error')}: ${error.message}`)
          return null
        } finally {
          buildingRef.current = false
        }
      }, [workspacePath, saveTab])

      const exportPdf = useCallback(async () => {
        if (workspacePath === null) return
        if (buildingRef.current) {
          showToast(t('toast.busy'))
          return
        }
        const receipt = await compile({ mode: 'full' })
        if (receipt === null || receipt === undefined || receipt.ok !== true) {
          showToast(t('paper.exportFailed'))
          return
        }
        const url = pdfUrl(workspacePath, Date.now())
        const anchor = document.createElement('a')
        anchor.href = `${url}${url.includes('?') ? '&' : '?'}download=1`
        anchor.rel = 'noreferrer'
        anchor.click()
      }, [workspacePath, compile])

      const stopBuild = useCallback(async () => {
        if (workspacePath === null) return
        try {
          await api('/stop', { body: { workspace: workspacePath } })
        } catch {
          // the build may already have finished
        }
      }, [workspacePath])

      useEffect(() => {
        if (savedAt === 0 || stateRef.current?.project?.autoCompile !== true) return undefined
        if (compileTimer.current !== null) clearTimeout(compileTimer.current)
        compileTimer.current = setTimeout(() => {
          compileTimer.current = null
          compile()
        }, 900)
        return () => {
          if (compileTimer.current !== null) {
            clearTimeout(compileTimer.current)
            compileTimer.current = null
          }
        }
      }, [savedAt, compile])

      const patchProject = useCallback(async (patch) => {
        if (workspacePath === null) return
        try {
          const payload = await api('/state', { body: { workspace: workspacePath, patch } })
          if (alive.current) setState(payload)
        } catch (error) {
          showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [workspacePath])

      const openProblem = useCallback(async (problem) => {
        if (problem.file === null || problem.file === undefined) return
        const entry = { path: problem.file, name: basename(problem.file), extension: extOf(problem.file), mtime: 0, size: 0 }
        await openFile(entry)
        if (problem.line !== null && problem.line !== undefined) {
          setJump({ path: problem.file, line: problem.line, at: Date.now() })
        }
      }, [openFile])

      const locateInPdf = useCallback(async (payload) => {
        if (workspacePath === null || activeTab === null) return
        try {
          const query = workspaceQuery(workspacePath, { path: activeTab.path, line: String(payload?.line ?? 1), column: '1' })
          const result = await api(`/synctex/forward?${query}`)
          setPdfPage(String(result.page))
          setPdfFit('width')
          setPdfReloadKey(Date.now())
        } catch {
          showToast(t('editor.locateFailed'))
        }
      }, [workspacePath, activeTab])

      const copyReference = useCallback(async ({ path, fromLine, toLine }) => {
        const absolute = workspacePath === null ? path : `${workspacePath}/${path}`
        const text = `@${absolute}${fromLine === toLine ? `#L${fromLine}` : `#L${fromLine}-L${toLine}`}`
        try {
          await navigator.clipboard.writeText(text)
          showToast(t('editor.copied'))
        } catch {
          showToast(text)
        }
      }, [workspacePath])

      const fixWithAgent = useCallback(() => {
        if (activeWorkspace === null || activeWorkspace === undefined || receipt === null) return
        const lines = [
          t('log.fixPromptTitle'),
          '',
          t('log.fixPromptMeta', {
            main: project?.mainDocument ?? '—',
            engine: project?.engine ?? '—',
            mode: project?.mode ?? '—',
          }),
          '',
          t('log.fixPromptErrors'),
        ]
        for (const error of (receipt.errors ?? []).slice(0, 12)) {
          lines.push(`- ${error.file ?? 'document'}${error.line === null || error.line === undefined ? '' : `:${error.line}`}: ${error.message}`)
        }
        for (const item of (receipt.missing ?? []).slice(0, 8)) lines.push(`- ${item.name}: ${item.hint}`)
        lines.push('', 'Log tail:', '```', String(receipt.logTail ?? '').slice(-3000), '```')
        props.startWritingAgent?.(activeWorkspace.workspaceId, lines.join('\n'))
      }, [activeWorkspace, receipt, project, t])

      const sendToAgent = useCallback((payload) => {
        if (activeWorkspace === null || activeWorkspace === undefined) return
        const header = activeWorkspace.title || basename(activeWorkspace.path)
        const lines = [t('editor.agentPromptTitle'), '']
        lines.push(t('editor.agentPromptFile', { path: payload.path, from: payload.fromLine, to: payload.toLine }))
        if (payload.text !== undefined && payload.text.trim() !== '') {
          lines.push(t('editor.agentPromptSelection'), '```latex', payload.text, '```')
        }
        lines.push('', t('editor.agentPromptAsk'))
        props.startWritingAgent?.(activeWorkspace.workspaceId, `${header}\n\n${lines.join('\n')}`)
      }, [activeWorkspace, t])

      const createFile = useCallback(async (input) => {
        if (workspacePath === null) return
        try {
          const receipt = await api('/new', { body: { workspace: workspacePath, ...input } })
          setModal(null)
          await loadDir(dirname(receipt.path) === '' ? '' : dirname(receipt.path))
          if (dirname(receipt.path) !== '') {
            setExpanded((previous) => new Set([...previous, dirname(receipt.path)]))
          }
          await refreshState({ quiet: true })
          await openFile({ path: receipt.path, name: basename(receipt.path), extension: 'tex', mtime: 0, size: 0 })
          showToast(t('editor.saved'))
        } catch (error) {
          showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [workspacePath, loadDir, refreshState, openFile])

      const initTemplate = useCallback(async (template, title) => {
        if (workspacePath === null) return
        try {
          const receipt = await api('/init', { body: { workspace: workspacePath, template, title } })
          setModal(null)
          if (receipt.state !== undefined) setState(receipt.state)
          setDirs({})
          await loadDir('')
          await refreshState({ quiet: true })
          await openFile({ path: 'main.tex', name: 'main.tex', extension: 'tex', mtime: 0, size: 0 })
          if (receipt.skipped?.length > 0) showToast(`${t('modal.initHint')} (${receipt.skipped.join(', ')})`)
        } catch (error) {
          showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [workspacePath, loadDir, refreshState, openFile])

      const runProbe = useCallback(async () => {
        setModal({ kind: 'env', probing: true })
        try {
          const environment = await api('/env/probe', { body: {} })
          if (!alive.current) return
          setModal({ kind: 'env', environment })
          setState((previous) => (previous === null ? previous : { ...previous, environment }))
        } catch (error) {
          showToast(`${t('toast.error')}: ${error.message}`)
        }
      }, [])

      const buildStatus = build.status !== 'idle' ? build.status : (dirtyCount > 0 ? 'dirty' : (project?.lastBuild?.status ?? 'idle'))
      const pdfStale = (receipt !== null && (receipt.status === 'failed' || receipt.status === 'stopped' || receipt.status === 'timeout' || receipt.pdf?.stale === true)) || project?.lastBuild?.ok === false
      const pdfDraft = (receipt?.mode ?? project?.mode) === 'fast'
      const pdf = state?.pdf ?? null
      const pdfVersion = pdf === null ? 0 : `${pdf.mtime}-${pdfReloadKey}`
      const pdfSrc = pdf === null ? null : pdfUrl(workspacePath, pdfVersion)
      const candidates = state?.candidates ?? []
      const mainChoices = candidates.length > 0 ? candidates : project === null || project.mainDocument === null ? [] : [{ path: project.mainDocument, name: basename(project.mainDocument) }]

      if (workspaceItems.length === 0) {
        return h('div', { className: 'leaf-root' },
          h('div', { className: 'leaf-overlay' },
            h('div', { className: 'leaf-card' },
              h('h2', null, t('welcome.noWorkspace')),
              h('p', null, t('welcome.noWorkspaceBody')),
            ),
          ),
        )
      }

      if (project !== null && project.enabled === false) {
        return h('div', { className: 'leaf-root' },
          h('div', { className: 'leaf-overlay' },
            h('div', { className: 'leaf-card' },
              h('h2', null, t('welcome.disabled')),
              h('p', null, t('welcome.disabledBody')),
              h('div', { className: 'leaf-form', style: { marginBottom: 14 } },
                h('label', null, t('toolbar.workspace'),
                  h('select', {
                    className: 'leaf-select',
                    value: workspacePath ?? '',
                    onChange: (event) => setActivePath(event.target.value),
                  }, workspaceItems.map((item) => h('option', { key: item.workspaceId, value: item.path }, item.title || basename(item.path)))),
                ),
              ),
              h('div', { className: 'leaf-card-actions' },
                h('button', { type: 'button', className: 'leaf-btn primary', onClick: () => patchProject({ enabled: true }) }, t('welcome.enable')),
              ),
            ),
          ),
        )
      }

      const onboarding = project !== null && project.mainDocument === null && candidates.length === 0

      const statusLabel = buildStatus === 'no-environment'
        ? t('status.noEnvironment')
        : t(`status.${buildStatus === 'success' || buildStatus === 'warning' || buildStatus === 'failed' || buildStatus === 'stopped' || buildStatus === 'timeout' || buildStatus === 'building' || buildStatus === 'dirty' ? buildStatus : 'idle'}`)

      return h('div', { className: 'leaf-root' },
        /* Row 1: workspace + environment + settings */
        h('div', { className: 'leaf-toolbar' },
          h('div', { className: 'leaf-brand' }, h(LeafMark, { size: 18 }), h('span', null, 'dsh-leaf')),
          h('label', { className: 'leaf-field' },
            h('span', null, t('toolbar.workspace')),
            h('select', {
              className: 'leaf-select',
              value: workspacePath ?? '',
              onChange: (event) => setActivePath(event.target.value),
              title: workspacePath ?? '',
            }, workspaceItems.map((item) => h('option', { key: item.workspaceId, value: item.path }, item.title || basename(item.path)))),
          ),
          h('span', { className: 'leaf-spacer' }),
          environment === null ? null : h('button', {
            type: 'button',
            className: `leaf-chip ${environment.status === 'ready' ? 'ok' : environment.status === 'missing' || environment.status === 'failed' ? 'bad' : ''}`,
            onClick: () => setModal({ kind: 'env', environment }),
            title: t('toolbar.env'),
          },
            h('span', { className: `leaf-dot ${environment.status === 'ready' ? 'ok' : environment.status === 'missing' || environment.status === 'failed' ? 'bad' : 'warn'}` }),
            t(`env.${environment.status === 'ready' ? 'ready' : environment.status === 'detected' ? 'detected' : environment.status === 'partial' ? 'partial' : environment.status === 'failed' ? 'failed' : 'missing'}`),
          ),
          h('button', { type: 'button', className: 'leaf-btn small ghost', title: t('toolbar.refresh'), onClick: () => { refreshState(); loadDir('') } }, h(Icon, { name: 'refresh' })),
          h('button', { type: 'button', className: 'leaf-btn small ghost', title: t('toolbar.settings'), onClick: () => setModal({ kind: 'settings' }) }, h(Icon, { name: 'settings' })),
        ),
        /* Row 2: project build controls */
        h('div', { className: 'leaf-toolbar second' },
          h('label', { className: 'leaf-field' },
            h('span', null, t('toolbar.main')),
            h('select', {
              className: 'leaf-select',
              value: project?.mainDocument ?? '',
              onChange: (event) => patchProject({ mainDocument: event.target.value === '' ? null : event.target.value }),
              title: t('modal.mainDocHint'),
            },
              project?.mainDocument === null ? h('option', { value: '' }, '—') : null,
              mainChoices.map((candidate) => h('option', { key: candidate.path, value: candidate.path }, candidate.path)),
            ),
          ),
          h('label', { className: 'leaf-field' },
            h('span', null, t('toolbar.engine')),
            h('select', {
              className: 'leaf-select',
              style: { maxWidth: 110 },
              value: project?.engine ?? 'xelatex',
              onChange: (event) => patchProject({ engine: event.target.value }),
            },
              h('option', { value: 'xelatex', disabled: environment?.engines?.xelatex === null }, 'XeLaTeX'),
              h('option', { value: 'pdflatex', disabled: environment?.engines?.pdflatex === null }, 'pdfLaTeX'),
            ),
          ),
          h('div', { className: 'leaf-field' },
            h('button', {
              type: 'button',
              className: `leaf-btn small ${project?.mode === 'full' ? '' : 'ghost'}`,
              onClick: () => patchProject({ mode: 'full' }),
              title: t('toolbar.mode.full'),
            }, t('toolbar.mode.full')),
            h('button', {
              type: 'button',
              className: `leaf-btn small ${project?.mode === 'fast' ? '' : 'ghost'}`,
              onClick: () => patchProject({ mode: 'fast' }),
              title: t('toolbar.mode.fast'),
            }, t('toolbar.mode.fast')),
          ),
          h(Switch, { checked: project?.autoCompile ?? true, onChange: (value) => patchProject({ autoCompile: value }), label: t('toolbar.auto') }),
          h('span', { className: 'leaf-spacer' }),
          h('span', { className: `leaf-chip ${buildStatus === 'failed' || buildStatus === 'timeout' ? 'bad' : buildStatus === 'success' ? 'ok' : ''}` },
            buildStatus === 'building' ? h('span', { className: 'leaf-spin' }) : h('span', { className: `leaf-dot ${buildStatus === 'failed' || buildStatus === 'timeout' ? 'bad' : buildStatus === 'success' ? 'ok' : buildStatus === 'building' ? 'busy' : 'warn'}` }),
            statusLabel,
          ),
          buildStatus === 'building'
            ? h('button', { type: 'button', className: 'leaf-btn small', onClick: stopBuild }, h(Icon, { name: 'stop' }), t('toolbar.stop'))
            : h('button', {
                type: 'button',
                className: 'leaf-btn primary',
                onClick: () => compile(),
                disabled: project?.mainDocument === null || environment?.available === false,
              }, h(Icon, { name: 'play' }), t('toolbar.compile')),
          h('button', { type: 'button', className: 'leaf-btn small ghost', title: t('toolbar.clean'), onClick: () => compile({ clean: true }) }, h(Icon, { name: 'trash' })),
        ),
        dirtyCount > 0 ? h('div', { className: 'leaf-banner' }, h('span', null, `${dirtyCount} ${t('editor.unsaved')}`), h('span', { className: 'leaf-spacer' }), h('button', { type: 'button', className: 'leaf-btn small', onClick: () => saveTab(activeTabPath) }, t('editor.save'))) : null,
        state?.ambiguousMain === true ? h('div', { className: 'leaf-banner warn' }, h(Icon, { name: 'warning' }), h('span', null, t('main.ambiguous'))) : null,
        loadError !== null ? h('div', { className: 'leaf-banner bad' }, h(Icon, { name: 'warning' }), h('span', null, loadError), h('span', { className: 'leaf-spacer' }), h('button', { type: 'button', className: 'leaf-btn small', onClick: () => refreshState() }, t('common.retry'))) : null,

        h('div', { className: 'leaf-body' },
          h(FileTree, {
            dirs,
            expanded,
            loading: treeLoading,
            activePath: activeTabPath ?? preview?.path ?? null,
            onToggle: toggleDir,
            onOpen: openFile,
            onLoad: loadDir,
            t,
            showAux,
            showHidden,
            onToggleAux: () => setShowAuxRaw((value) => !boolStored(value, false)),
            onToggleHidden: () => setShowHiddenRaw((value) => !boolStored(value, false)),
            onNewFile: () => setModal({ kind: 'new-file' }),
            onInit: () => setModal({ kind: 'init' }),
            onRefresh: () => loadDir(''),
            onReveal: (entry) => api('/reveal', { body: { workspace: workspacePath, path: entry.path } }).catch(() => {}),
            width: treeWidth,
          }),
          h('div', { className: 'leaf-resizer', onPointerDown: onTreeResize, 'aria-hidden': true }),
          h('div', { className: 'leaf-editor-col' },
            h('div', { className: 'leaf-tabs' },
              tabs.map((tab) => h('div', {
                key: tab.path,
                className: `leaf-tab${tab.path === activeTabPath && preview === null ? ' active' : ''}`,
                onClick: () => { setActiveTabPath(tab.path); setPreview(null) },
                title: tab.path,
              },
                h(TypeBadge, { name: tab.name }),
                h('span', { className: 'leaf-name' }, tab.name),
                saving === tab.path ? h('span', { className: 'leaf-spin' }) : tab.content !== tab.savedContent ? h('span', { className: 'leaf-dirty' }) : null,
                h('button', {
                  type: 'button',
                  className: 'leaf-close',
                  title: t('editor.close'),
                  onClick: (event) => {
                    event.stopPropagation()
                    setTabs((previous) => previous.filter((item) => item.path !== tab.path))
                    if (activeTabPath === tab.path) setActiveTabPath(null)
                  },
                }, '×'),
              )),
            ),
            preview !== null
              ? h(PreviewPane, { preview, workspace: workspacePath, onClose: () => setPreview(null), onToast: showToast, t })
              : activeTab === null
                ? h('div', { className: 'leaf-editor-wrap' },
                    onboarding
                      ? h('div', { className: 'leaf-card', style: { margin: 'auto', maxWidth: 540 } },
                          h('h2', null, t('welcome.title')),
                          h('p', null, t('welcome.body')),
                          h('div', { className: 'leaf-card-actions' },
                            h('button', { type: 'button', className: 'leaf-btn primary', onClick: () => initTemplate('zh', '') }, t('welcome.initZh')),
                            h('button', { type: 'button', className: 'leaf-btn', onClick: () => initTemplate('en', '') }, t('welcome.initEn')),
                            h('button', { type: 'button', className: 'leaf-btn ghost', onClick: () => setModal({ kind: 'new-file' }) }, t('tree.new')),
                          ),
                        )
                      : h('div', { style: { margin: 'auto', textAlign: 'center', color: 'var(--dsw-alias-label-tertiary)', padding: 24 } },
                          h('div', null, t('editor.empty')),
                          h('div', { style: { fontSize: 12, marginTop: 6 } }, t('editor.emptyHint')),
                        ),
                  )
                : h(React.Fragment, null,
                    activeTab.conflict === true
                      ? h('div', { className: 'leaf-banner bad' },
                          h(Icon, { name: 'warning' }),
                          h('div', null, h('div', null, t('editor.conflict')), h('div', { style: { fontSize: 11, opacity: .8 } }, t('editor.conflictHint'))),
                          h('span', { className: 'leaf-spacer' }),
                          h('button', {
                            type: 'button',
                            className: 'leaf-btn small',
                            onClick: async () => {
                              try {
                                const payload = await api(`/file?${workspaceQuery(workspacePath, { path: activeTab.path })}`)
                                setTabs((previous) => previous.map((item) => (item.path === activeTab.path ? { ...item, content: payload.content, savedContent: payload.content, mtime: payload.mtime, conflict: false } : item)))
                              } catch (error) {
                                showToast(error.message)
                              }
                            },
                          }, t('editor.reload')),
                          h('button', {
                            type: 'button',
                            className: 'leaf-btn small primary',
                            onClick: () => {
                              setTabs((previous) => previous.map((item) => (item.path === activeTab.path ? { ...item, conflict: false } : item)))
                              saveTab(activeTab.path, { force: true })
                            },
                          }, t('editor.overwrite')),
                        )
                      : null,
                    h(LatexEditor, {
                      tab: activeTab,
                      jump,
                      t,
                      onChange: (content) => updateTab(activeTab.path, content),
                      onSave: () => saveTab(activeTab.path),
                      onCompile: () => compile(),
                      onReference: copyReference,
                      onSendToAgent: sendToAgent,
                      onCursor: (payload) => {
                        if (payload?.locate === true) locateInPdf(payload)
                      },
                    }),
                  ),
            h(LogPane, {
              open: logOpen,
              receipt,
              onToggle: () => setLogOpenRaw((value) => !boolStored(value, true)),
              onOpenProblem: openProblem,
              onFullLog: () => window.open(new URL(`dsh-leaf/log?${workspaceQuery(workspacePath)}`, document.baseURI).href, '_blank'),
              onFixWithAgent: fixWithAgent,
              t,
              height: 190,
            }),
          ),
          h('div', { className: 'leaf-resizer', onPointerDown: onPaperResize, 'aria-hidden': true }),
          h(PaperPane, {
            url: pdfSrc,
            stale: pdfStale || (pdf === null && buildStatus === 'failed'),
            draft: pdfDraft,
            page: pdfPage,
            fit: pdfFit,
            onPage: setPdfPage,
            onFit: setPdfFit,
            onReload: () => setPdfReloadKey(Date.now()),
            onExport: exportPdf,
            t,
            style: paperWidth > 0 ? { width: paperWidth } : {},
            onResizeStart: onPaperResize,
          }),
        ),
        toast === null ? null : h('div', { className: 'leaf-toast' }, toast),
        modal === null ? null : renderModal(modal, {
          t,
          project,
          state,
          candidates,
          environment,
          workspacePath,
          onClose: () => setModal(null),
          onCreateFile: createFile,
          onInit: initTemplate,
          onPatch: patchProject,
          onProbe: runProbe,
          onRedetect: redetectEnv,
        }),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Modals                                                              */
    /* ------------------------------------------------------------------ */

    function renderModal(modal, context) {
      const { t, onClose } = context
      if (modal.kind === 'new-file') return h(NewFileModal, { ...context })
      if (modal.kind === 'init') return h(InitModal, { ...context })
      if (modal.kind === 'settings') return h(SettingsModal, { ...context })
      if (modal.kind === 'env') return h(EnvironmentModal, { ...context, modal })
      return null
    }

    function NewFileModal({ onClose, onCreateFile, project, t }) {
      const [folder, setFolder] = useState('sections')
      const [name, setName] = useState('')
      const [kind, setKind] = useState(project?.mainDocument === null ? 'main' : 'section')
      const [title, setTitle] = useState('')
      const submit = () => {
        const cleanName = name.trim().replace(/^\/+/, '')
        if (cleanName === '') return
        const path = folder.trim() === '' ? cleanName : `${folder.trim().replace(/\/+$/, '')}/${cleanName}`
        onCreateFile({ path, kind, title: title.trim() === '' ? undefined : title.trim() })
      }
      return h(Modal, {
        title: t('modal.newFile'),
        subtitle: t('modal.fileNameHint'),
        onClose,
        actions: [
          h('button', { key: 'c', type: 'button', className: 'leaf-btn', onClick: onClose }, t('modal.cancel')),
          h('button', { key: 'ok', type: 'button', className: 'leaf-btn primary', onClick: submit, disabled: name.trim() === '' }, t('modal.create')),
        ],
      },
        h('div', { className: 'leaf-form' },
          h('label', null, t('modal.folder'),
            h('input', { className: 'leaf-input', value: folder, onChange: (event) => setFolder(event.target.value), placeholder: 'sections' }),
          ),
          h('label', null, t('modal.fileName'),
            h('input', { className: 'leaf-input', value: name, onChange: (event) => setName(event.target.value), placeholder: 'related-work.tex', onKeyDown: (event) => { if (event.key === 'Enter') submit() } }),
          ),
          h('label', null, t('modal.kind'),
            h('select', { className: 'leaf-select', value: kind, onChange: (event) => setKind(event.target.value) },
              h('option', { value: 'section' }, t('modal.kind.section')),
              h('option', { value: 'main' }, t('modal.kind.main')),
            ),
          ),
          h('label', null, t('modal.title'),
            h('input', { className: 'leaf-input', value: title, onChange: (event) => setTitle(event.target.value) }),
          ),
        ),
      )
    }

    function InitModal({ onClose, onInit, t }) {
      const [template, setTemplate] = useState('zh')
      const [title, setTitle] = useState('')
      return h(Modal, {
        title: t('modal.init'),
        subtitle: t('modal.initHint'),
        onClose,
        actions: [
          h('button', { key: 'c', type: 'button', className: 'leaf-btn', onClick: onClose }, t('modal.cancel')),
          h('button', { key: 'ok', type: 'button', className: 'leaf-btn primary', onClick: () => onInit(template, title.trim()) }, t('modal.initRun')),
        ],
      },
        h('div', { className: 'leaf-form' },
          h('label', null, t('modal.template'),
            h('div', { className: 'leaf-modal-list' },
              h('label', { className: `leaf-radio${template === 'zh' ? ' selected' : ''}` },
                h('input', { type: 'radio', name: 'leaf-template', checked: template === 'zh', onChange: () => setTemplate('zh') }),
                h('span', { className: 'leaf-radio-body' },
                  h('span', { className: 'leaf-radio-title' }, t('modal.template.zh')),
                  h('span', { className: 'leaf-radio-sub' }, 'main.tex · sections/ · figures/ · references.bib'),
                ),
              ),
              h('label', { className: `leaf-radio${template === 'en' ? ' selected' : ''}` },
                h('input', { type: 'radio', name: 'leaf-template', checked: template === 'en', onChange: () => setTemplate('en') }),
                h('span', { className: 'leaf-radio-body' },
                  h('span', { className: 'leaf-radio-title' }, t('modal.template.en')),
                  h('span', { className: 'leaf-radio-sub' }, 'main.tex · sections/ · figures/ · references.bib'),
                ),
              ),
            ),
          ),
          h('label', null, t('modal.title'),
            h('input', { className: 'leaf-input', value: title, onChange: (event) => setTitle(event.target.value) }),
          ),
        ),
      )
    }

    function SettingsModal({ onClose, onPatch, project, candidates, t }) {
      const [main, setMain] = useState(project?.mainDocument ?? '')
      const [cwd, setCwd] = useState(project?.buildCwd ?? '')
      const [enabled, setEnabled] = useState(project?.enabled !== false)
      const save = () => {
        onPatch({ mainDocument: main === '' ? null : main, buildCwd: cwd === '' ? null : cwd, enabled })
        onClose()
      }
      return h(Modal, {
        title: t('modal.settings'),
        onClose,
        actions: [
          h('button', { key: 'c', type: 'button', className: 'leaf-btn', onClick: onClose }, t('modal.cancel')),
          h('button', { key: 's', type: 'button', className: 'leaf-btn primary', onClick: save }, t('modal.save')),
        ],
      },
        h('div', { className: 'leaf-form' },
          h('label', null, t('modal.mainDoc'),
            h('select', { className: 'leaf-select', value: main, onChange: (event) => setMain(event.target.value) },
              h('option', { value: '' }, '—'),
              candidates.map((candidate) => h('option', { key: candidate.path, value: candidate.path }, candidate.path)),
              main !== '' && !candidates.some((candidate) => candidate.path === main) ? h('option', { value: main }, main) : null,
            ),
            h('span', { className: 'leaf-hint' }, t('modal.mainDocHint')),
          ),
          h('label', null, t('modal.buildCwd'),
            h('input', { className: 'leaf-input', value: cwd, onChange: (event) => setCwd(event.target.value), placeholder: '.' }),
            h('span', { className: 'leaf-hint' }, t('modal.buildCwdHint')),
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            h(Switch, { checked: enabled, onChange: setEnabled, label: t('modal.enable') }),
          ),
          h('span', { className: 'leaf-hint' }, t('modal.enableHint')),
        ),
      )
    }

    function EnvironmentModal({ modal, environment, onClose, onProbe, onRedetect, t }) {
      const current = modal.environment ?? environment
      const probing = modal.probing === true
      const status = current?.status ?? 'missing'
      const engineEntries = Object.entries(current?.engines ?? {})
      return h(Modal, {
        title: t('env.title'),
        subtitle: current?.distribution ?? '',
        onClose,
        actions: [
          h('button', { key: 'd', type: 'button', className: 'leaf-btn', onClick: onRedetect, disabled: probing }, t('env.redetect')),
          h('button', { key: 'p', type: 'button', className: 'leaf-btn primary', onClick: onProbe, disabled: probing }, probing ? [h('span', { key: 's', className: 'leaf-spin' }), t('env.probing')] : t('env.probe')),
          h('button', { key: 'c', type: 'button', className: 'leaf-btn', onClick: onClose }, t('modal.close')),
        ],
      },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            h('span', { className: `leaf-dot ${status === 'ready' ? 'ok' : status === 'missing' || status === 'failed' ? 'bad' : 'warn'}` }),
            h('strong', null, t(`env.${status === 'ready' ? 'ready' : status === 'detected' ? 'detected' : status === 'partial' ? 'partial' : status === 'failed' ? 'failed' : 'missing'}`)),
          ),
          h('div', { className: 'leaf-muted', style: { fontSize: 12, lineHeight: 1.6 } },
            status === 'missing' ? t('env.installHint') : status === 'partial' ? t('env.partialHint') : current?.message ?? '',
          ),
          current?.probe === null || current?.probe === undefined ? null : h('div', null,
            h('div', { style: { fontSize: 12, marginBottom: 4 } }, current.probe.ok ? t('env.probeOk') : t('env.probeFailed')),
            current.probe.log ? h('pre', { className: 'leaf-code-block' }, current.probe.log) : null,
          ),
          h('div', null,
            h('div', { className: 'leaf-muted', style: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 } }, t('env.engines')),
            h('dl', { className: 'leaf-kv' },
              engineEntries.map(([name, info]) => h(React.Fragment, { key: name },
                h('dt', null, name),
                h('dd', null, info === null ? '—' : h('span', { title: info.path }, info.version || info.path)),
              )),
            ),
          ),
        ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    function installStyles() {
      const tagId = 'dsh-leaf/styles'
      let node = document.querySelector(`style[data-plugin-css="${tagId}"]`)
      if (node === null) {
        node = document.createElement('style')
        node.dataset.plugin = 'dsh-leaf'
        node.dataset.pluginCss = tagId
        node.textContent = CSS
        document.head.appendChild(node)
      }
      return () => node.remove()
    }

    function SidebarLeafIcon({ size = 18 }) {
      return h('span', { style: { display: 'inline-flex', color: 'var(--dsw-alias-label-primary)' } }, h(LeafMark, { size }))
    }

    function MenuLeafIcon(props) {
      return h('span', { style: { display: 'inline-flex', color: 'var(--dsw-alias-label-primary)' } }, h(LeafMark, { size: 16 }))
    }

    function apply(ctx) {
      const store = createLeafStore()
      const t = ctx.locale.bind(NS)
      const openLeaf = (path, file = null) => {
        if (path !== undefined) store.open(path, file)
        try {
          ctx.layout.selectPanel(PANEL_ID)
        } catch {
          // the panel may still be registering during a hot reload
        }
      }

      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-leaf: dictionaries')
      ctx.effect(() => installStyles(), 'dsh-leaf: styles')

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
        inject: () => ({
          hooks: { leaf: store.source },
          openPanel: openLeaf,
          startWritingAgent: (workspaceId, prompt) => ctx.uiWorkspace.startSession(workspaceId, {
            prompt,
            whenDraftExists: 'append',
          }),
        }),
      }, LeafPanel))

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 2,
        label: () => t('panel'),
        locale: NS,
      }, SidebarLeafIcon))

      ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
        name: 'contextMenu.icon',
        key: MENU_OPEN,
      }, MenuLeafIcon))

      ctx.effect(() => ctx.contextMenus.register({
        id: MENU_OPEN,
        target: 'workspace',
        order: 150,
        resolve: (target) => [{
          id: 'open',
          label: t('menu.open'),
          icon: { key: MENU_OPEN },
          run: () => openLeaf(target.path),
        }],
      }), 'dsh-leaf: workspace menu action')

      ctx.effect(() => ctx.contextMenus.register({
        id: MENU_CLOSE,
        target: 'workspace',
        order: 160,
        resolve: (target) => [{
          id: 'close',
          label: t('menu.close'),
          run: async () => {
            try {
              await api('/state', { body: { workspace: target.path, patch: { enabled: false } } })
              ctx.contextMenus.notify(t('menu.disabled'), true)
            } catch (error) {
              ctx.contextMenus.notify(`${t('toast.error')}: ${error.message}`, false)
            }
          },
        }],
      }), 'dsh-leaf: workspace close action')

      const workspaceOfSession = (sessionId) => {
        const session = ctx.sessions?.list?.getSnapshot?.()?.byId?.[sessionId]
        const cwd = session?.cwd
        if (typeof cwd !== 'string' || cwd === '') return null
        const items = ctx.workspaces?.list?.getSnapshot?.()?.items ?? []
        return items.find((item) => cwd === item.path || cwd.startsWith(`${item.path}/`)) ?? null
      }

      const relativeToWorkspace = (workspacePath, file) => {
        if (typeof file !== 'string') return file
        if (!file.startsWith('/')) return file
        if (file === workspacePath) return ''
        return file.startsWith(`${workspacePath}/`) ? file.slice(workspacePath.length + 1) : file
      }

      ctx.effect(() => ctx.contextMenus.register({
        id: 'dsh-leaf.file-open',
        target: 'file',
        order: 180,
        resolve: (target) => {
          const workspace = workspaceOfSession(target.sessionId)
          if (workspace === null) return []
          return [{
            id: 'open',
            label: t('menu.open'),
            icon: { key: MENU_OPEN },
            run: () => openLeaf(workspace.path, relativeToWorkspace(workspace.path, target.path)),
          }]
        },
      }), 'dsh-leaf: file open action')

      ctx.effect(() => ctx.contextMenus.register({
        id: 'dsh-leaf.file-latex',
        target: 'file',
        order: 190,
        resolve: (target) => {
          const workspace = workspaceOfSession(target.sessionId)
          const file = workspace === null ? target.path : relativeToWorkspace(workspace.path, target.path)
          const extension = extOf(file)
          const isTex = ['tex', 'ltx'].includes(extension)
          const isFigure = IMAGE_EXT.has(extension) || extension === 'pdf'
          if (!isTex && !isFigure) return []
          const snippet = isFigure
            ? `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${file}}\n  \\caption{}\n  \\label{fig:${basename(file).replace(/\.[^.]+$/, '')}}\n\\end{figure}`
            : `\\input{${file.replace(/\.tex$/, '')}}`
          return [
            {
              id: 'copy-snippet',
              label: t('menu.copySnippet'),
              run: async () => {
                try {
                  await navigator.clipboard.writeText(snippet)
                  ctx.contextMenus.notify(t('menu.copySnippetDone'), true)
                } catch (error) {
                  ctx.contextMenus.notify(`${t('toast.error')}: ${error.message}`, false)
                }
              },
            },
            {
              id: 'copy-path',
              label: t('preview.copyPath'),
              run: async () => {
                try {
                  await navigator.clipboard.writeText(file)
                  ctx.contextMenus.notify(t('menu.copyPathDone'), true)
                } catch (error) {
                  ctx.contextMenus.notify(`${t('toast.error')}: ${error.message}`, false)
                }
              },
            },
          ]
        },
      }), 'dsh-leaf: file latex actions')

      ctx.effect(() => ctx.shortcuts.register({
        id: 'dsh-leaf.open',
        label: () => t('panel.open'),
        aliases: ['leaf', 'latex'],
        defaults: {
          'desktop:macos': { code: 'KeyL', modifiers: ['primary', 'shift'] },
          'desktop:windows': { code: 'KeyL', modifiers: ['primary', 'shift'] },
          'desktop:linux': { code: 'KeyL', modifiers: ['primary', 'shift'] },
          'web:macos': { code: 'KeyL', modifiers: ['primary', 'shift'] },
          'web:windows': { code: 'KeyL', modifiers: ['primary', 'shift'] },
          'web:linux': { code: 'KeyL', modifiers: ['primary', 'shift'] },
        },
        regions: ['page', 'editable'],
        modals: ['sidebar'],
        resolve: ({ modal }) => (modal !== null && modal !== 'sidebar'
          ? { status: 'pass' }
          : { status: 'handled', run: () => openLeaf() }),
      }), 'dsh-leaf: open shortcut')
    }

    return {
      inject: ['slots', 'layout', 'locale', 'contextMenus', 'shortcuts', 'uiWorkspace', 'sessions', 'workspaces'],
      apply,
    }
  },
})
