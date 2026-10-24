"""Offline checks; run with the connector's isolated Python environment."""
import asyncio
from types import SimpleNamespace

from jd_taobao_mcp.browser import BrowserController
from jd_taobao_mcp.config import Settings
from jd_taobao_mcp.safety import page_requires_user_verification


class LoginPage:
    url = "https://passport.jd.com/new/login.aspx"

    def is_closed(self):
        return False

    def locator(self, _):
        return self

    async def count(self):
        return 1

    async def inner_text(self, **_):
        return "手机扫码安全登录"


async def main():
    for url in ["https://passport.jd.com/new/login.aspx", "https://login.taobao.com/member/login.jhtml", "https://cfe.m.jd.com/privaterisk/risk_handler.html"]:
        assert page_requires_user_verification("", url)
    assert not page_requires_user_verification("商品价格", "https://search.jd.com/Search?keyword=passport.jd.com")

    async def cookies():
        return [{"name": "pt_key", "domain": ".jd.com"}]

    browser = BrowserController(Settings.from_env())
    browser._context = SimpleNamespace(cookies=cookies)
    browser._page = LoginPage()
    result = await browser.check_login("jd")
    assert not result["likely_logged_in"]
    assert result["requires_user_verification"]
    print("LOGIN_REDIRECT_AND_STALE_SESSION_CHECKS_PASSED")


if __name__ == "__main__":
    asyncio.run(main())
