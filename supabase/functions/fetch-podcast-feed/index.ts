import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  url: string;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseXml(xml: string): PodcastEpisode[] {
  const episodes: PodcastEpisode[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const id = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? "";
    const title = entry.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
    const published = entry.match(/<published>(.*?)<\/published>/)?.[1] ?? "";
    const description = entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1]?.trim() ?? "";

    if (id) {
      episodes.push({
        id,
        title: decodeHtmlEntities(title),
        description: decodeHtmlEntities(description).slice(0, 200),
        thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
        publishedAt: published,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
  }

  return episodes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const playlistId = "PLjiVHbXlNlOYoKmSvlxTwUX94NEyTzmbr";
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;

    const proxyUrls = [
      rssUrl,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`,
    ];

    let xml = "";
    let lastError = "";

    for (const url of proxyUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/xml, text/xml, application/atom+xml, */*",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        clearTimeout(timeout);

        if (response.ok) {
          const text = await response.text();
          if (text.includes("<entry>") && text.includes("yt:videoId")) {
            xml = text;
            break;
          }
          lastError = `${url} returned non-XML content`;
        } else {
          lastError = `${url} returned ${response.status}`;
          await response.text();
        }
      } catch (e: unknown) {
        lastError = `${url}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    if (!xml) {
      console.error("All RSS endpoints failed. Last error:", lastError);
      return new Response(JSON.stringify({ episodes: [], error: "RSS temporarily unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const episodes = parseXml(xml);

    return new Response(JSON.stringify({ episodes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error fetching podcast feed:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error), episodes: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
