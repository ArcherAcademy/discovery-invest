import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RSS_URL = "https://anchor.fm/s/1021da5bc/podcast/rss";

interface SpotifyEpisode {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  url: string;
  duration: string;
  spotifyId: string;
}

function parseDuration(raw: string): string {
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m] = parts;
    if (h > 0) return `${h}u ${m}min`;
    return `${m} min`;
  }
  return raw;
}

function extractSpotifyId(url: string): string {
  const match = url.match(/-([a-z0-9]+)$/i);
  return match?.[1] ?? "";
}

function toCreatorsEpisodeUrl(url: string): string {
  return url
    .replace("https://podcasters.spotify.com/pod/show/", "https://creators.spotify.com/pod/profile/")
    .replace("http://podcasters.spotify.com/pod/show/", "https://creators.spotify.com/pod/profile/");
}

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch(RSS_URL);
    if (!res.ok) throw new Error(`RSS fetch failed [${res.status}]`);
    const xml = await res.text();

    const items = xml.split("<item>").slice(1);
    const episodes: SpotifyEpisode[] = [];

    for (const item of items) {
      const get = (tag: string): string => {
        const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
        const m = item.match(re);
        return m ? stripCdata(m[1].trim()) : "";
      };

      const title = get("title");
      const link = get("link");
      const guid = get("guid");
      const pubDate = get("pubDate");
      const descriptionRaw = get("description");
      const duration = get("itunes:duration");
      const imageMatch = item.match(/<itunes:image\s+href="([^"]+)"/i);
      const thumbnailUrl = imageMatch?.[1] ?? "";
      const spotifyId = extractSpotifyId(link);
      const description = stripHtml(descriptionRaw).slice(0, 200);

      episodes.push({
        id: guid || spotifyId,
        title,
        description,
        thumbnailUrl,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : "",
        url: link ? toCreatorsEpisodeUrl(link) : "",
        duration: duration ? parseDuration(duration) : "",
        spotifyId,
      });
    }

    return new Response(JSON.stringify({ episodes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error fetching Spotify RSS feed:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error), episodes: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
