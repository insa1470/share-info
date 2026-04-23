企业智慧学习平台：全流程部署与运营手册

适用域名：deepmystic.net | 核心引擎：DeepSeek AI | 存储：Cloudflare KV

壹、 系统架构概观 (The Architecture)

本系统采用「前后端全整合」架构，所有零件均存放于您的专属域名内，确保在大陆境内拥有最高的连线优先权。

门牌 (域名)：deepmystic.net (Cloudflare 托管)。

店面 (前端)：index.html (存放于 GitHub，透过 Cloudflare Pages 发布)。

大脑 (后端)：functions/api/[[path]].js (Pages Functions，负责处理 AI 与数据)。

金库 (数据库)：Cloudflare KV (STUDY_STORAGE)，存放发布后的考题。

贰、 文件结构与 GitHub 管理 (GitHub Setup)

GitHub 是系统的原始码仓库。请确保您的储存库 (Repo) 结构严格遵守以下路径：

1. 根目录文件

index.html：用户界面文件。

functions/ (文件夹)：

api/ (子文件夹)：

[[path]].js：后端逻辑文件（包含 API Key）。

2. 更新机制

您只要在 GitHub 网页上编辑文件并点击 「Commit changes」，Cloudflare Pages 会在 1 分钟内自动感应并完成全网同步，无需手动重新发布。

叁、 Cloudflare 后台关键设置 (Cloudflare Configuration)

这是系统能「通电」运作的核心步骤，若出现 Code 500 错误，通常是这里的设置失效。

1. KV 命名空间 (金库)

路径：存储空间和数据库 -> KV。

名称：STUDY_STORAGE。

2. 函数绑定 (授权访问)

这是最重要的「转发」动作，让网页有权利读写金库：

进入 「Workers 和 Pages」 -> 点击您的 Pages 项目。

点击 「设置」 (Settings) -> 「函数」 (Functions)。

找到 「KV 命名空间绑定」。

点击 「新增绑定」：

变量名称：STUDY_DB (必须全大写，一字不差)。

KV 命名空间：选择 STUDY_STORAGE。

点击 「保存」。

肆、 管理员运营流程 (Admin Operations)

1. 登录与环境检查

访问 https://deepmystic.net。

检查左上角连线灯号：

🟢 绿灯：系统完全正常。

🔴 红灯：API 连线中断，请检查 Cloudflare 绑定。

2. 智能出题三部曲

导入素材：支持 PDF、Word、图片或手动粘贴。

出题设置：点击「AI 智能出题」后，选择题数。点击下方弹出的 「🚀 开始出题」。

人工校阅：AI 生成后，您可以直接在网页上修改题目文字、选项或解析。

3. 正式发布

填写「卷宗名称」（单元标题）。

点击 「🚀 正式发布至云端」。一旦显示成功，全行同仁的手机端会立刻同步看到。

伍、 常见错误排除 (Troubleshooting)

错误代码 / 现象

可能原因

解决方法

Code 405

API 路径或文件位置不对

检查 GitHub 文件是否位于 functions/api/[[path]].js。

Code 500

金库未授权

确认 Pages 设置中的 KV 绑定变量名为 STUDY_DB。

Failed to fetch

域名解析尚未完全生效

等待 10-30 分钟，或尝试切换 4G/5G 网络。

题目没更新

浏览器缓存 (Cache) 影响

点击首页下方的「强制刷新数据连线」或使用无痕模式。

陆、 未来扩充建议 (Future Expansion)

多分行管理：若要分开管理不同部门，可透过在 functions/api/[[path]].js 增加用户验证逻辑。

安全性升级：可在 Cloudflare 开启 Zero Trust，限制只有分行内部人员的 Email 才能访问。

数据分析：目前数据库仅存储题目。未来可扩充「成绩单」功能，将同仁答题记录存回 KV。

行长的话：
「知识是银行的核心资产，AI 是转化资产的加速器。愿此系统成为分行精进业务的强大助力。」
