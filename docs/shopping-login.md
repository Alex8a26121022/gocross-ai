# 购物平台登录

连接器安装在 `C:\Users\Rain9\AppData\Local\GoCross\jd-taobao-mcp`。

配置文件是安装目录中的 `.env`，只存浏览器位置、会话目录和只读设置，不需要账号密码字段。

由用户在平台官方登录页扫码或输入凭据，浏览器自行保存登录会话：

- 京东：`C:\Users\Rain9\AppData\Local\GoCross\shopping-sessions\jd`
- 淘宝：`C:\Users\Rain9\AppData\Local\GoCross\shopping-sessions\taobao`

天猫页面能否复用淘宝登录需实测，不能仅凭同一平台体系保证成功。登录失效后需要再次登录。

这些文件夹含敏感登录状态，不能上传、分享或提交到 Git；不导出 Cookie 值，也不使用日常 Chrome/Edge 个人资料。连接器会在浏览器内检查会话，本地探测结果只保存状态布尔值。项目 `.gitignore` 也排除了常见会话目录。

当前只准备登录和会话复用。登录完成不代表实时取价、同款比价或天猫独立搜索已验证。淘宝商品搜索此前被工具的站点安全策略拒绝，不通过这个连接器绕过该限制。

默认配置已设为后台浏览器模式（PLAYWRIGHT_HEADLESS=true）；取数探测也强制后台运行。只有显式运行 shopping-login.py 才打开供用户扫码的窗口。前台商品搜索框尚未接入这个连接器，不能把后台模式等同于已经完成比价接入。

2026-10-16 实测：两个会话在首页均出现登录迹象，但京东商品搜索跳回 passport.jd.com 登录页。连接器原来只凭旧 Cookie 也会报告已登录，已对本机副本和下载副本修复：登录/验证页面优先于 Cookie 线索。离线回归检查为 tests/shopping_connector_check.py，使用连接器虚拟环境执行。实际搜索未得到有效报价，后台模式的取价尚未验证。
