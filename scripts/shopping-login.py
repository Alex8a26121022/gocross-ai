"""Open official login pages through the installed MCP; credentials stay in the browser."""
import asyncio
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main():
    platforms = sys.argv[1:] or ["jd", "taobao"]
    if any(platform not in {"jd", "taobao"} for platform in platforms):
        raise SystemExit("Use jd or taobao")
    root = Path(os.environ["LOCALAPPDATA"]) / "GoCross" / "jd-taobao-mcp"
    parameters = StdioServerParameters(
        command=str(root / ".venv" / "Scripts" / "python.exe"),
        args=[str(root / "server.py")],
        cwd=str(root),
        env={**os.environ, "ALLOW_STATE_CHANGING_ACTIONS": "false", "PLAYWRIGHT_HEADLESS": "false"},
    )
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            names = {tool.name for tool in (await session.list_tools()).tools}
            assert "open_login" in names
            print("MCP connected using local stdio; no HTTP port.", flush=True)
            for platform in platforms:
                print(f"Opening {platform} official login page...", flush=True)
                result = await session.call_tool("open_login", {"platform": platform})
                print(f"{platform}: {'failed' if result.isError else 'login page ready'}", flush=True)
            print("Complete login in the browser. Keep this process running; Ctrl+C closes it.", flush=True)
            await asyncio.Event().wait()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
