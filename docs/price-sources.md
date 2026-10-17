# 国内平台即时价格核验（2026-10-16）

用户确认没有联盟凭据、不增加付费服务，要求查询当时价格。以下记录实际结果，不以仓库宣传代替证据。

- [mcp-pricepeek](https://github.com/eesire-debug/mcp-pricepeek)：已下载阅读。src/index.ts 的搜索仍是待接官方 API 的占位，价格 0、available=false；未安装运行或接入。
- [shopmeskills/mcp](https://github.com/shopmeskills/mcp)：已下载阅读，MIT。源码使用 https://api.shopmeagent.com/mcp/goods/search，虽然说明称无需 key，现场响应 HTTP 401 明确要求产品 API key；未集成。源码支持枚举为 xhs/taobao/tmall，不能认定京东已可用。
- 其他候选有模拟数据回退或限制衍生使用的许可，未引入。没有复制第三方运行代码，也没有把假价格带进产品。

京东 HTTP 与浏览器均进入风险/登录验证页，未得到价格。淘宝、天猫最初 HTTP 只返回动态外壳；随后淘宝浏览器访问被站点安全策略拒绝，未用其他浏览器、HTTP、代理或间接后台请求绕过。后续逻辑验证使用注入响应，停止这两个来源的实际请求。

已实现标准 JSON-LD 公开价解析、商品域名校验、时效、汇率、保守同款合并、单价卡和详情入口。测试证明注入的同款京东低价能正确排首，**不是京东线上取价成功**。

实际有效报价仍来自中免澳门，全平台即时比价目标未完成，需要实际可读取的报价来源或登录后的可验证商品页。下载 GitHub 项目不能替代数据来源。

另：后台服务启动被自动审批拒绝，未给出原因；未更换执行渠道继续启动。浏览器只确认 5173 连接拒绝，本轮新界面尚未完整验证。

## 登录型连接器候选补充

2026-10-16 用户愿意用开发测试账号验证，不希望消费者逐个平台登录。已下载静态审阅 [JD-Taobao-MCP](https://github.com/HaonanYu123/JD-Taobao-MCP)（MIT，个人维护，非京东官方）和 [taobao-native 参考](https://github.com/Aiden1670/taobao-native)；另有 [本地 MCP 接入说明](https://github.com/Zaki362/taobao-agent/blob/main/docs/taobao-mcp-bridge.md) 描述淘宝桌面版服务。仓库对官方能力的描述仍待真实客户端核验。机器尚无已检测到的淘宝桌面版/CLI，未安装、启用或登录；未执行第三方仓库。

京东候选支持持久化浏览器会话与 DOM 取价，但解析可能误取页面数字，需要本项目校验。淘宝桌面版资料含搜索/天猫筛选/规格工具，可作为下一步验证方向，尚无本机成功调用证据。插件目录检索未找到对应连接器。安装包下载未完成，已取消并标为 partial，签名未验证、没有执行。没有将测试账号方案当成已完成的多用户产品接入。

## API 型候选（2026-10-16）

| 项目 | 工作方式 | 核验结论 |
|---|---|---|
| [everywill/jd-union-node-sdk](https://github.com/everywill/jd-union-node-sdk) | Node 后台请求京东联盟 API | 已读签名/响应源码；需 appKey/secretKey 和相应权限；非官方维护，尚未实测 API |
| [yangxiaozhan/shopunion_sdk](https://github.com/yangxiaozhan/shopunion_sdk) | PHP 统一淘宝/京东/拼多多 API | 需开发者凭据；composer 声明 MIT；可参考设计，当前 Node 项目不因此换栈 |
| [MadHouses/taobao-openapi](https://github.com/MadHouses/taobao-openapi) | Node TOP API 客户端 | 需 AppKey/Secret，默认 HTTP；旧示例不能证明现有商品接口可用，未安装 |
| [h382110229/price-hunter](https://github.com/h382110229/price-hunter) | Python 联盟 API 比价 MCP | 下载静态审阅 c428245b53363b1032140dd81c49e7f9b01afead；无 Key 返回模拟商品，京东为精选池过滤、券条件处理不足，不直接部署 |

这些候选能提供后台接口代码，但不授予平台商品查询权限。现有购物账号密码不等于 AppKey/Secret；当前缺少凭据，不能验证实时价格、覆盖或费用。没有引用仓库公开的疑似泄露凭据进行尝试。方案建议尚未转为已完成接入。
