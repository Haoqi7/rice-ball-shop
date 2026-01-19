# **🍙 家用饭团小铺 (Family Rice Ball Shop)**

一个基于 **微信小程序原生开发** \+ **微信云开发 (CloudBase)** 构建的家庭内部点餐系统。  
专为家庭聚会或小型私厨场景设计，无需购买服务器和域名，实现了“一人下单，全家同步，后厨接单通知”的完整闭环体验。

## **✨ 核心亮点**

* **☁️ 零成本部署**：基于微信云开发基础版（免费），无需维护传统后端。  
* **🔄 多端实时同步**：利用云数据库 watch 监听技术，顾客下单后，后厨端无需刷新即可秒级弹出新订单。  
* **🔔 独创通知机制**：  
  * **消息订阅池**：突破微信一次性订阅限制，后厨人员可手动点击按钮“充值”接收次数（点一次收一条）。  
  * **群发通知**：顾客下单后，系统自动查找所有有剩余次数的后厨人员并群发微信通知。  
  * **闭环反馈**：后厨制作完成后，自动通知顾客取餐。  
* **📱 极简交互**：  
  * **无图模式**：纯文字菜单，加载快，维护简单。  
  * **全家共享**：下单页显示家庭所有最近订单，支持多人协作管理。  
* **🛠️ 完备后台**：手机端直接管理菜单（增删改查）、修改密码、一键清洗历史数据。

## **📂 目录结构**

rice-ball-shop/  
├── cloudfunctions/          \# 云函数目录  
│   └── sendMsg/             \# 核心消息推送函数 (处理订阅消息发送)  
├── pages/  
│   ├── index/               \# 首页 (入口/导航)  
│   ├── order/               \# 下单页 (菜单、购物车、公共订单列表)  
│   ├── order-detail/        \# 订单详情 (状态进度条、取消订单)  
│   ├── kitchen/             \# 后厨页 (接单、通知开关、制作管理)  
│   └── admin/               \# 管理页 (菜单编辑、密码设置、数据清洗)  
├── app.js                   \# 全局入口 (云菜单初始化)  
└── project.config.json      \# 项目配置

## **🚀 部署指南 (从零开始)**

### **1\. 环境准备**

1. 注册微信小程序账号，获取 **AppID**。  
2. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。  
3. 导入本项目，填入你的 AppID。

### **2\. 开通云开发**

1. 点击工具栏左上角的“云开发”按钮，开通环境（建议选择免费按量付费版）。  
2. 复制你的 **环境 ID** (Env ID)。  
3. 在 app.js 和 cloudfunctions/sendMsg/index.js 中确认环境初始化代码（通常默认即可）。

### **3\. 数据库配置 (关键)**

进入云开发控制台 \-\> **数据库**，创建以下 3 个集合，并修改 **数据权限** 为“自定义安全规则”：

* **orders** (存储订单):  
  { "read": true, "write": true }

* **menu** (存储菜品):  
  { "read": true, "write": true }

* **subscribers** (存储后厨通知订阅者):  
  { "read": true, "write": true }

  *注意：权限必须设为所有人可读写，以便实现异地多手机同步。*

### **4\. 消息推送配置**

1. 登录微信公众平台 \-\> 功能 \-\> 订阅消息。  
2. 申请一个模板（例如“下单成功通知”），需包含以下字段（Key需对应）：  
   * 菜品名称 (thing1)  
   * 下单时间 (time6)  
   * 订单状态 (thing7)  
   * 备注 (thing10)  
3. 获取 **模板 ID**。

### **5\. 代码配置与隐私脱敏**

**⚠️ 在发布到 GitHub 或公开前，请务必处理以下文件中的敏感信息：**

* **project.config.json**:  
  * 将 appid 修改为 touristappid 或你的占位符。  
* **pages/order/order.js**:  
  * 搜索 const TEMPLATE\_ID，替换为你申请的模板 ID。  
* **pages/kitchen/kitchen.js**:  
  * 搜索 const TEMPLATE\_ID，替换为同一模板 ID。  
* **cloudfunctions/sendMsg/index.js**:  
  * 搜索 templateId，替换为同一模板 ID。

### **6\. 部署云函数**

1. 在开发者工具中，右键点击 cloudfunctions/sendMsg 文件夹。  
2. **务必选择** 👉 **“上传并部署：云端安装依赖”**（不要选“所有文件”，否则会因缺失 node\_modules 报错）。

## **📝 使用说明**

1. **初始化**：首次编译运行，app.js 会自动检测云端并上传默认菜单。  
2. **后厨准备 (手机A)**：  
   * 进入“后厨”页面。  
   * 打开“后厨身份登记”开关。  
   * **多次点击**绿色按钮“点击增加次数 (+1)”，积攒通知额度。  
3. **顾客下单 (手机B)**：  
   * 进入“下单”页面，选择菜品并提交。  
   * 无需额外操作，系统会自动通知手机A。  
4. **制作闭环**：  
   * 手机A收到微信通知，点击进入小程序。  
   * 在后厨页点击“开始制作” \-\> “制作完成”。  
   * 手机B（顾客）会收到“制作完成”的取餐通知。

## **🔧 常见问题**

* **收不到通知？**  
  * 检查云函数是否部署成功（必须选“安装依赖”）。  
  * 检查后厨页面的“剩余次数”是否大于 0。  
  * 检查云数据库 subscribers 集合是否有数据。  
* **异地无法操作？**  
  * 请检查数据库权限是否已设置为 { "read": true, "write": true }。

## **📄 开源协议**

本项目采用 [MIT License](https://www.google.com/search?q=LICENSE) 开源。  
*Code with ❤️ by \[你的名字\]*  
\---

\#\#\# 🛡️ 隐私脱敏清单 (Checklist)

在将代码提交到 GitHub 之前，请按照下表检查并修改文件，防止隐私泄露：

| 文件路径 | 需修改内容 | 操作建议 |  
| :--- | :--- | :--- |  
| \`project.config.json\` | \`appid\` | 改为 \`"touristappid"\` 或 \`""\` |  
| \`project.private.config.json\` | 整个文件 | \*\*不要上传\*\*。确保已添加到 \`.gitignore\` |  
| \`cloudfunctions/sendMsg/index.js\` | \`templateId\` | 改为 \`'YOUR\_TEMPLATE\_ID'\` |  
| \`pages/order/order.js\` | \`const TEMPLATE\_ID\` | 改为 \`'YOUR\_TEMPLATE\_ID'\` |  
| \`pages/kitchen/kitchen.js\` | \`const TEMPLATE\_ID\` | 改为 \`'YOUR\_TEMPLATE\_ID'\` |  
| \`app.js\` | \`env\` (如果写死) | 建议留空让小程序自动识别，或改为 \`'YOUR\_ENV\_ID'\` |

建议在项目根目录创建 \`.gitignore\` 文件：  
\`\`\`gitignore  
node\_modules/  
miniprogram\_npm/  
project.private.config.json  
unpackage/  
dist/  
