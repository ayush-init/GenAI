import config from "../config/config.js";

/**
 * Multi-Tiered Web Search Engine
 * Priority:
 * 1. Tavily Search API (Best for AI RAG)
 * 2. Serper Google Search API (Fallback 1)
 * 3. DuckDuckGo Free Search (Fallback 2 - 100% Free)
 */
export async function performWebSearch(query, maxResults = 5) {
    if (!query || !query.trim()) {
        return [];
    }

    console.log(`\n🔍 [WebSearch Tool] Searching web for: "${query}"`);

    // -----------------------------------------------------------------
    // Tier 1: Tavily API
    // -----------------------------------------------------------------
    if (config.tavilyApiKey) {
        try {
            console.log("   Attempting Tier 1: Tavily Search API...");
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: config.tavilyApiKey,
                    query: query,
                    search_depth: "basic",
                    max_results: maxResults,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    console.log(`   ✅ Tavily returned ${data.results.length} live web results.`);
                    return data.results.map((r) => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.content,
                        provider: "Tavily",
                    }));
                }
            } else {
                console.warn(`   ⚠️ Tavily status ${response.status}: ${response.statusText}`);
            }
        } catch (err) {
            console.warn(`   ⚠️ Tavily error: ${err.message}`);
        }
    }

    // -----------------------------------------------------------------
    // Tier 2: Serper API
    // -----------------------------------------------------------------
    if (config.serperApiKey) {
        try {
            console.log("   Attempting Tier 2: Serper Google Search API...");
            const response = await fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: {
                    "X-API-KEY": config.serperApiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ q: query, num: maxResults }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.organic && data.organic.length > 0) {
                    console.log(`   ✅ Serper returned ${data.organic.length} live web results.`);
                    return data.organic.map((r) => ({
                        title: r.title,
                        url: r.link,
                        snippet: r.snippet,
                        provider: "Serper",
                    }));
                }
            } else {
                console.warn(`   ⚠️ Serper status ${response.status}: ${response.statusText}`);
            }
        } catch (err) {
            console.warn(`   ⚠️ Serper error: ${err.message}`);
        }
    }

    // -----------------------------------------------------------------
    // Tier 3: DuckDuckGo Free Search (Fallback)
    // -----------------------------------------------------------------
    try {
        console.log("   Attempting Tier 3: DuckDuckGo Free Search Fallback...");
        const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
            }
        );

        if (response.ok) {
            const html = await response.text();
            
            // Extract snippets using regex from DuckDuckGo HTML response
            const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/gi;
            const titleRegex = /<a class="result__url[^>]*>(.*?)<\/a>/gi;

            const snippets = [];
            let match;

            while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
                const cleanText = match[1].replace(/<[^>]+>/g, "").trim();
                if (cleanText) {
                    snippets.push({
                        title: "Web Result",
                        url: "https://duckduckgo.com",
                        snippet: cleanText,
                        provider: "DuckDuckGo (Free)",
                    });
                }
            }

            if (snippets.length > 0) {
                console.log(`   ✅ DuckDuckGo Free returned ${snippets.length} results.`);
                return snippets;
            }
        }
    } catch (err) {
        console.warn(`   ⚠️ DuckDuckGo error: ${err.message}`);
    }

    console.warn("   ❌ All web search providers failed to return results.");
    return [];
}
