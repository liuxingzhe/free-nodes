# AutoProxyGenerator 🚀

一个专为代理节点优选、自动化采集、网络时延测速与多协议智能路由订阅分发的轻量级解决方案。

本系统不仅支持在本地一键运行，还可以通过 **GitHub Actions + GitHub Pages** 实现全天候定时（如每6小时一次）自动抓取全球节点、本地测试优质节点延迟和下载速度、去除重复项，并一键部署，为您提供免费、高可用、自动更新的 Clash / Sing-box 订阅链接。

---

## 🌟 核心特色

- **多模式爬虫支持**：
  - `github_scraper`：支持拉取 GitHub 各种开源节点仓库、Base64 订阅文本并快速断行解密。
  - `telegram_scraper`：免 API Key，直接采集 Telegram 频道网页预览中的可用节点。
- **卓越的精确去重框架**：通过算法拼接核心字段 `protocol + server + port + uuid` 生成 MD5 校验，避免节点备注不同而引入重复冗余节点。
- **高并发双模式测速内核**：
  - 采用 **LiteSpeedTest 二进制** 启动高并发线程连接对真实的节点进行物理 PING 测速与大文件下载 bandwidth 测速。
  - **自动平台识别** 动态下载对应 Linux / macOS / Windows 的测速二进制。
  - 当无系统执行权限或多端测试环境限制时，自动升级并降级成 **Python Socket TCP 并行高速连接嗅探**，完美兼容任意平台。
- **多端协议转换分发技术**：
  - **Base64**：常规的节点地址换行 Base64 文件。
  - **Clash YAML**：带 `Select`、`负载均衡` 与 `自动最快` 智能测速组的 Clash 规则文件。
  - **Sing-box JSON**：符合全新 Sing-box 1.18+ 标准的 极客 Outbound 订阅。
- **全要素托管工作流**：支持 GitHub Pages 免租，通过配置 Secrets 一键自部署。

---

## 📂 项目结构

```bash
AutoProxyGenerator/
├── .github/
│   └── workflows/
│       └── run_and_deploy.yml   # GitHub Actions 工作流，定时运行并部署到 Pages
├── scrapers/
│   ├── __init__.py
│   ├── base_scraper.py         # 爬虫基类
│   ├── github_scraper.py       # 采集 GitHub 订阅源与 RAW 文件的爬虫
│   └── telegram_scraper.py     # 采集 Telegram 频道网页版预览的爬虫
├── utils/
│   ├── __init__.py
│   ├── parser.py               # 解析各种节点协议 (vmess, vless, ss, trojan, hy2)
│   ├── tester.py               # 自动下载、配置并调用 LiteSpeedTest 测速
│   └── convertor.py            # 转换为 Base64 / Clash YAML / Sing-box JSON 格式
├── templates/
│   ├── clash_template.yaml     # Clash 配置文件模板
│   └── singbox_template.json   # Sing-box 配置文件模板
├── config.yaml                 # 爬取源列表与系统配置参数
├── main.py                     # 主程序入口
└── requirements.txt            # 项目依赖
```

---

## 🛠️ 本地运行指南

###  Prerequisites (前置准备)

确保您本地安装了 **Python 3.10** 或更高版本。

### 1. 克隆代码与依赖安装

进入项目所在的文件夹，执行依赖下载包来安装所需库：

```bash
pip install -r requirements.txt
```

### 2. 进行爬取渠道自定义配置

更改根目录下的 `config.yaml` 丰富您的公开源：

```yaml
scrapers:
  github_sources:
    - name: "My custom Github source"
      url: "https://raw.githubusercontent.com/...your...url"
      type: "base64"
  telegram_channels:
    - name: "Another TG Channel"
      channel: "VPN_FreeSub"
```

### 3. 开始执行程序

运行以下命令，系统会自动下载匹配本地平台的 `lite-speedtest` 可执行程序并启动多维度跑分：

```bash
python main.py
```

执行完毕后，生成的合规订阅文件会完美落地至新创建的 `dist/` 文件夹内：
- `dist/sub.txt` (Base64)
- `dist/clash.yaml` (Clash)
- `dist/singbox.json` (Sing-box)

---

## 🚀 GitHub Actions 定时更新部署教程

利用 GitHub 的 GitHub Pages 功能，你完全不需要自己租用额外的服务器即可搭建完全专属你一人的优选高速节点订阅网站，以下是保姆级步骤：

### 第一步：新建一个个人私有或公开 GitHub 仓库
将本项目的所有文件推送到您的 GitHub 仓库。

### 第二步：授予 Actions 定时向仓库写入配置文件的权限
- 登录您的 GitHub 页面，进入刚克隆的仓库。
- 点击右上角的 **Settings** -> 左侧菜单栏 **Actions** -> **General**。
- 向下滚动找到 **Workflow permissions**，选择 **Read and write permissions**，然后点击 **Save**。

### 第三步：激活 GitHub Pages 部署选项
- 在该仓库的 **Settings** -> 左侧菜单栏 **Pages**。
- 在 **Build and deployment** 区的 **Source** 选项选择为 **Deploy from a branch**。
- 随后将 **Branch** 切换为 **gh-pages** 并点击 **Save** 保存。
  *(注：该 gh-pages 分支是 GitHub Actions 工作流在第一次正常执行完成后，会自动帮您创建和推送结果的，如果还未创建，等 Actions 成功跑完一次手动触发后再次配置即可。)*

### 第四步：手动触发第一次运行 (可选)
- 点击该仓库的 **Actions** 菜单。
- 在左侧选择 **AutoProxyGenerator CI/CD**。
- 点击右侧的 **Run workflow** 下拉，直接点击绿色的 **Run workflow** 按钮。
- 等待几分钟，当绿勾亮起后，您的代理节点分网就会完美托管至 GitHub 提供的超高速静态带宽中。

### 🎈 终于拥有了完美的自动分发！

您可以按照以下链接格式获取您专配的高速订阅资源：

- **Clash 订阅地址**：`https://<你的 GitHub 用户名>.github.io/<你的仓库名>/clash.yaml`
- **Singbox 订阅地址**：`https://<你的 GitHub 用户名>.github.io/<你的仓库名>/singbox.json`
- **Base64 订阅地址**：`https://<你的 GitHub 用户名>.github.io/<你的仓库名>/sub.txt`

*Actions 默认每 6 小时会自动重跑测试，过滤去重并上架新节点。*

---

## ⚖️ 免责声明 (Disclaimer)

1. 本软件及配套爬虫开源项目仅供学术科研交流、网络技术分析、网络协议健壮度学习目的，请勿将其用于任何商业化违法行为。
2. 数据全部搜集自互联网公开信源，作者并不拥有、也不对数据源提供方产生的所有内容、服务品质、网络状态承担任何形式的连带保证。使用过程中请遵守所在国家和地区的法律法规。
