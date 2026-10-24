"""Check saved login state and make one read-only JD product search."""
import asyncio
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def tool_data(result):
    if result.isError:
        raise RuntimeError("Connector tool failed")
    if result.structuredContent is not None:
        data = result.structuredContent
    else:
        data = json.loads(next(block.text for block in result.content if block.type == "text"))
    return data.get("result", data)


async def main():
    root = Path(os.environ["LOCALAPPDATA"]) / "GoCross" / "jd-taobao-mcp"
    parameters = StdioServerParameters(
        command=str(root / ".venv" / "Scripts" / "python.exe"),
        args=[str(root / "server.py")], cwd=str(root),
        env={**os.environ, "ALLOW_STATE_CHANGING_ACTIONS": "false", "PLAYWRIGHT_HEADLESS": "true"},
    )
    output = {"login": {}, "jd": None, "taobao_search": "not_attempted_policy_restriction"}
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            try:
                for platform in ["jd", "taobao"]:
                    data = tool_data(await session.call_tool("check_login", {"platform": platform}))
                    output["login"][platform] = {"likely_logged_in": data.get("likely_logged_in"), "requires_user_verification": data.get("requires_user_verification")}
                    print(json.dumps({platform: output["login"][platform]}), flush=True)
                print("Checking JD product search...", flush=True)
                data = tool_data(await session.call_tool("search_products", {"platform": "jd", "keyword": "SK-II 清莹嫩肤露 160ml", "max_results": 5, "include_details": False}))
                output["jd"] = {"success": data.get("success"), "requires_user_verification": data.get("requires_user_verification", data.get("verification_warning")), "count": data.get("count", 0), "items": [{key: item.get(key) for key in ["title", "price", "price_text", "shop", "url"]} for item in data.get("items", [])]}
                print(json.dumps(output["jd"], ensure_ascii=False), flush=True)
                snapshot = tool_data(await session.call_tool("page_snapshot", {"max_chars": 18000}))
                parsed = urlsplit(snapshot.get("url", ""))
                text = snapshot.get("text", "")
                output["jd"]["page_check"] = {"host": parsed.hostname, "path": parsed.path, "text_length": len(text), "signals": {label: label in text for label in ["清莹", "嫩肤", "暂无", "没有找到", "请登录", "验证", "价格", "综合排序"]}, "product_links": [item for item in snapshot.get("links", []) if urlsplit(item.get("href", "")).hostname == "item.jd.com"][:8]}
                print(json.dumps(output["jd"]["page_check"], ensure_ascii=False), flush=True)
                if parsed.hostname == "search.jd.com" and output["jd"]["page_check"]["product_links"]:
                    screenshot = tool_data(await session.call_tool("take_screenshot", {"full_page": False}))
                    output["jd"]["screenshot"] = screenshot.get("path")
                if parsed.hostname == "passport.jd.com":
                    output["login"]["jd"] = {"likely_logged_in": False, "requires_user_verification": True}
                    output["jd"]["success"] = False
                    output["jd"]["requires_user_verification"] = True
                    output["jd"]["reason"] = "search_redirected_to_login"
                result_file = Path(__file__).resolve().parent.parent / ".runtime" / "shopping-probe.json"
                result_file.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
                if "--keep-open" in sys.argv:
                    print("Browser stays open. Commands: check, search, quit.", flush=True)
                    while True:
                        command = (await asyncio.to_thread(sys.stdin.readline)).strip()
                        if command == "quit" or not command:
                            break
                        if command == "check":
                            result = tool_data(await session.call_tool("check_login", {"platform": "jd"}))
                            print(json.dumps({"likely_logged_in": result.get("likely_logged_in"), "requires_user_verification": result.get("requires_user_verification")}), flush=True)
                        elif command == "search":
                            result = tool_data(await session.call_tool("search_products", {"platform": "jd", "keyword": "SK-II 清莹嫩肤露 160ml", "max_results": 5, "include_details": False}))
                            print(json.dumps({"success": result.get("success"), "requires_user_verification": result.get("requires_user_verification", result.get("verification_warning")), "items": [{key: item.get(key) for key in ["title", "price", "price_text", "shop", "url"]} for item in result.get("items", [])]}, ensure_ascii=False), flush=True)
                        else:
                            print("Use check, search or quit.", flush=True)
            finally:
                await session.call_tool("browser_close", {})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
