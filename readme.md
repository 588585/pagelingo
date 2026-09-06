# PageLingo — 双语网页翻译

PageLingo 是基于旧版 Immersive Translate 的独立分支，用于网页双语对照翻译。

项目仓库：[588585/pagelingo](https://github.com/588585/pagelingo)。

- 本地仓库及 npm 包名：`pagelingo`
- 扩展名称：`PageLingo`
- Firefox 扩展 ID：`{385f9dfc-34cf-4f67-a6f6-14eee6678b5c}`
- Firefox 最低版本：桌面 140，Android 142

## 构建

本版本构建环境为 Windows x64、Node.js `22.23.1`、npm `10.9.8`。
从 [Node.js 官网](https://nodejs.org/en/download) 安装相应版本，使用 `node --version` 和 `npm --version` 检查。
构建依赖由仓库中的 `package-lock.json` 锁定；请使用 `npm ci`，不要在审核构建时更新依赖或 Browserslist 数据库。

```sh
git clone https://github.com/588585/pagelingo.git
cd pagelingo
npm ci
npm run build
```

如果使用源码 ZIP，将其解压后进入包含 `package.json` 的目录，直接执行最后两条命令。
安装依赖需要访问 npm；构建本身不需要 Mozilla 账号、API 密钥或翻译服务凭据。

单独构建 Firefox：`npm run firefox`；单独构建 Chrome/Edge：`npm run chrome`。
完整构建会清理并重新生成 `dist`，不要在其中保存手工修改。

当前扩展版本为 `0.0.41`，输出文件为：

- `dist/pagelingo-firefox-0.0.41.zip`：上传到 Mozilla AMO 签名。
- `dist/pagelingo-chrome-0.0.41.zip`：Chrome/Edge 压缩包。
- `dist/firefox`：Firefox 临时载入目录。
- `dist/chrome`：Chrome/Edge 开发者模式加载目录。

ZIP 文件名自动使用 manifest 中的版本号。Firefox 本地构建包尚未签名，需在 AMO 以新附加组件提交。签名后升级同一附加组件必须保持上述 ID 不变，并递增版本号。

翻译功能会向所选翻译服务发送网页内容；Firefox manifest 已声明必需的 `websiteContent` 数据传输权限。

## Mozilla AMO 源代码提交

在“您需要提交源代码吗？”中选择“是”。本项目使用 Gulp 和 Babel 对源文件进行处理：

- Babel 转换 `src/background/*.js`，并生成内嵌 source map。
- Gulp 将 HTML 中的 `__PAGELINGO_VERSION__` 替换为扩展版本号。
- Chrome 构建额外切换 manifest，并合并后台脚本；Firefox 构建不执行该合并步骤。
- 最后将构建目录打包成 ZIP。

“附加组件包”上传 `pagelingo-firefox-0.0.41.zip`；“源代码”上传同一提交生成的 `pagelingo-source-0.0.41.zip`，两者不是同一个文件。
源码包应包含 `src/`、`gulpfile.js`、`package.json`、`package-lock.json`、README 和许可证，不包含 `node_modules/`、`.git/` 或构建输出。

在提交修改后，可从同一提交生成源码 ZIP（先执行构建，确保 `dist` 已存在）：

```sh
git archive --format=zip --output=dist/pagelingo-source-0.0.41.zip HEAD
```

只复现 Firefox 构建时，审核者可以执行：

```sh
npm ci
npm run firefox
```

英文审核说明见 [AMO reviewer build instructions](docs/amo-review.md)。
官方要求见 [Mozilla Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/)。

## 来源

当前仓库：[588585/pagelingo](https://github.com/588585/pagelingo)，对应 Git 远程 `origin`。
上游：[immersive-translate/old-immersive-translate](https://github.com/immersive-translate/old-immersive-translate)，对应 Git 远程 `upstream`。

原项目介绍、历史商店链接和旧使用说明保存在 [上游原始说明](docs/upstream-readme.md)，不代表 PageLingo 已发布。
许可证及原作者版权声明见 [LICENSE](LICENSE)。
