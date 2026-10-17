# 团队代码与网页预览

这是与本机使用同一套源码的云端运行副本。成员看见的是 Codespaces 中运行的页面，不是对你电脑屏幕的远程控制；两边后续代码修改需要通过 Git 同步。

当前共享地址：[GoCross 团队预览](https://super-duper-robot-jrqrj964x76qh5rxq-5173.app.github.dev/)。2026-10-17 经项目负责人确认，5173 已设为 Public；云端匿名 HTTP 检查返回 200，商品接口返回 6 件真实中免商品。本机浏览器访问曾网络超时，不将其描述为已完成所有成员网络的页面验收。

## 在已有 Codespace 运行

将项目代码放到仓库工作目录后，在终端运行：

```sh
node --version
npm test
HOST=0.0.0.0 PORT=5173 DISABLED_MARKET_PLATFORMS=taobao,tmall npm start
```

需要 Node.js 20 以上，本项目无需安装第三方 Node 依赖。不要覆盖成员现有文件；先检查当前分支、未提交改动与已有服务。

打开底部 **PORTS / 端口** 面板，转发 `5173`，再复制平台显示的完整预览 URL。发给成员的是这个 URL，而不是 `github.dev` 编辑器入口或你电脑的 `127.0.0.1`。

端口默认私有，通常仅 Codespace 所有者能访问；若希望其他人查看，需要根据 GitHub 提供的选项设置组织内共享或公开。公开后任何知道链接的人都能访问，应先确定共享范围；仓库协作者身份不自动等于私有端口访问权限。组织策略可能限制可选范围。

`.devcontainer/devcontainer.json` 使用 Codespaces 默认镜像，不另装项目运行依赖；创建容器时运行测试，启动容器时后台启动服务并转发 5173。已有 Codespace 需要重建后配置才生效，也可以先用上述命令直接运行。服务输出保存在 `.runtime/server.log`；容器停止后网页不可访问，已查询关键词的每日采集也暂停。

## 凭据与功能边界

- `.env`、浏览器登录会话和 Cookie 不放入代码仓库或代码压缩包，密钥不会因为上传源码自动进入 Codespace。
- 项目负责人已确认所有访客都可直接识图，已用 SK-II 商品图片通过云端网页实际上传验证。当前密钥保存在云端工作目录的 `.env`，权限为 600、被 Git 忽略、位于静态服务目录以外；经临时加密封包传输，没有将明文写入命令、仓库或前端。该文件随 `/workspaces` 保留，删除 Codespace 后需重新配置。
- 仓库 Codespaces secret 写入要求管理员权限，当前协作账号仅有代码写入权限；没有扩大账号授权。仓库管理员以后可将 `ZHIPU_API_KEY` 迁移至 Codespaces development secret，再停止并重新启动 Codespace。服务端支持环境变量优先读取，只返回是否已配置及模型名，图片不落盘。
- 通过 GitHub 注入的 `CODESPACES`、`CODESPACE_NAME`、`GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` 自动确定当前 5173 HTTPS 预览来源。隧道会将 Origin 改写成 HTTPS localhost，此时额外要求浏览器 `Sec-Fetch-Site: same-origin`；拒绝跨站请求，本机原有来源保护保留。公开接口没有用户登录，同源校验不等于身份认证；保留全服务一次一个识图任务、每分钟最多 10 次请求和 8 MB 图片上限，以免并发耗尽免费配额。
- 国内平台取价仍受现有登录及工具访问限制；本配置保留淘宝/天猫自动采集禁用状态，不附带电商账号。
- 新机器上的汇率、官网商品由其后端独立获取；失败时不会用你电脑缓存或样例价补位。

官方说明：[Codespaces 端口转发与共享](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)、[开发容器配置](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers)。

## 休眠与在线时间

GitHub Settings → Codespaces → Default idle timeout 可设置 5–240 分钟，默认设置用于新建 Codespace，组织策略可能更短。即使继续活跃，Codespace 也有最长 12 小时运行周期；没有永久不休眠的选项。停止或休眠期间预览和采集任务都不可用，重新启动后恢复。持续给公众提供服务需另外部署常驻服务器，当前没有开通收费托管。

官方说明：[闲置超时设置](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces)、[持久化环境变量与密钥](https://docs.github.com/en/codespaces/developing-in-a-codespace/persisting-environment-variables-and-temporary-files)。
