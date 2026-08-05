"""
IRMS scraper using Playwright — fallback for when direct API returns 400 (reCAPTCHA required).
Opens the public IRMS search page, fills the PIB in the appropriate input, clicks search,
and captures the resulting business-entities JSON response.
"""
import asyncio
import os
import logging
from typing import Optional, Dict, Any

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_browser = None
_playwright = None


async def _get_browser():
    """Lazy-init a single Chromium instance reused across requests."""
    global _browser, _playwright
    if _browser is not None:
        return _browser
    try:
        from playwright.async_api import async_playwright
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        return _browser
    except Exception as e:
        logger.warning(f"Playwright init failed: {e}")
        return None


async def _new_context(browser):
    ctx = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        viewport={"width": 1440, "height": 900},
        locale="sr-Latn-ME",
    )
    await ctx.add_init_script(
        "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
    )
    return ctx


async def lookup_pib_via_browser(pib: str, timeout_ms: int = 25000) -> Optional[Dict[str, Any]]:
    """
    Open IRMS search page, fill PIB, click search, capture API JSON.
    Returns the parsed 'results' JSON payload if found, or None on failure.
    """
    async with _lock:  # serialize to keep Playwright resource usage low
        browser = await _get_browser()
        if not browser:
            return None
        
        context = None
        try:
            context = await _new_context(browser)
            page = await context.new_page()
            
            captured: Dict[str, Any] = {"search": None, "detail": None, "roles": None, "taxpayer_id": None}
            
            async def on_response(response):
                url = response.url
                try:
                    if "business-entities?" in url and "/api/" in url and response.status == 200:
                        body = await response.json()
                        captured["search"] = body
                    elif "/api/business-entity/" in url and "/ownership-roles" in url and response.status == 200:
                        captured["roles"] = await response.json()
                    elif "/api/business-entity/" in url and "ownership-roles" not in url and response.status == 200:
                        captured["detail"] = await response.json()
                except Exception:
                    pass
            
            page.on("response", on_response)
            
            await page.goto(
                "https://irms.tax.gov.me/public/search-register/business-entities",
                wait_until="networkidle",
                timeout=timeout_ms,
            )
            # Give reCAPTCHA time to bootstrap
            await page.wait_for_timeout(1500)
            
            # Fill PIB field (Unesite identifikacioni broj / PIB)
            filled = False
            for selector in [
                'input[name="identificationNumber"]',
                'input[placeholder*="identifikacioni"]',
                'input[placeholder*="PIB"]',
                'input[type="text"]:visible',
            ]:
                try:
                    await page.fill(selector, pib, timeout=3000)
                    filled = True
                    break
                except Exception:
                    continue
            
            if not filled:
                logger.warning("Could not find PIB input on IRMS page")
                return None
            
            await page.wait_for_timeout(400)
            
            # Click Search button (Pretraga)
            clicked = False
            for selector in [
                'button:has-text("Pretraga")',
                'button:has-text("Pretraži")',
                'button[type="submit"]',
                'button:has-text("Search")',
            ]:
                try:
                    await page.click(selector, timeout=2500)
                    clicked = True
                    break
                except Exception:
                    continue
            
            if not clicked:
                await page.keyboard.press("Enter")
            
            # Wait for search response
            for _ in range(20):
                await page.wait_for_timeout(500)
                if captured["search"] is not None:
                    break
            
            search_body = captured["search"]
            if not search_body:
                logger.warning(f"No search response captured for PIB {pib}")
                return None
            
            results = search_body.get("results") or []
            if not results:
                return {"results": [], "found": False}
            
            first = results[0]
            taxpayer_id = first.get("taxpayerId") or first.get("id")
            captured["taxpayer_id"] = taxpayer_id
            
            # Click first row to load detail + roles
            if taxpayer_id:
                try:
                    # Try clicking the row text
                    await page.click(f'text="{first.get("name", "")}"', timeout=2500)
                    for _ in range(20):
                        await page.wait_for_timeout(500)
                        if captured["detail"] is not None and captured["roles"] is not None:
                            break
                except Exception:
                    pass
            
            return {
                "found": True,
                "search": search_body,
                "detail": captured.get("detail") or {},
                "roles": captured.get("roles") or {},
                "taxpayer_id": taxpayer_id,
            }
        except Exception as e:
            logger.warning(f"Playwright lookup failed for PIB {pib}: {e}")
            return None
        finally:
            if context:
                try:
                    await context.close()
                except Exception:
                    pass


async def close_browser():
    """Cleanup on shutdown."""
    global _browser, _playwright
    try:
        if _browser:
            await _browser.close()
    except Exception:
        pass
    try:
        if _playwright:
            await _playwright.stop()
    except Exception:
        pass
    _browser = None
    _playwright = None
