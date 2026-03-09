import { Vehicle } from "@/lib/types";

interface RecallRecord {
  component: string | null;
  summary: string | null;
  consequence: string | null;
  reportReceivedDate: string | null;
  nhtsaCampaignNumber: string | null;
}

export interface ResearchReviewLink {
  label: string;
  url: string;
}

export interface ResearchVideo {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  channelKey: string;
  thumbnailUrl: string | null;
  kind: "full" | "clip";
}

export interface VehicleResearch {
  recallCount: number;
  recentRecalls: RecallRecord[];
  commonIssueThemes: string[];
  reviewLinks: ResearchReviewLink[];
  videos: ResearchVideo[];
}

interface VideoChannel {
  key: string;
  label: string;
  channelId?: string;
  handle?: string;
  filter?: (video: ResearchVideo) => boolean;
}

const VIDEO_CHANNELS: VideoChannel[] = [
  {
    key: "doug-demuro",
    label: "Doug DeMuro",
    channelId: "UCsqjHFMB_JYTaEnf_vmTNqg",
    handle: "@DougDeMuro"
  },
  {
    key: "cars-and-bids",
    label: "Cars & Bids",
    channelId: "UCG72WbiCvdB6JKU-3YRP8Kg"
  },
  {
    key: "auto-focus",
    label: "Auto Focus",
    handle: "@AutoFocus"
  }
];

function buildVehicleQuery(vehicle: Vehicle) {
  return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`.replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function matchTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1].trim()) : "";
}

function matchLink(block: string) {
  const hrefMatch = block.match(/<link[^>]+href="([^"]+)"/i);
  if (hrefMatch) {
    return hrefMatch[1];
  }

  const textMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
  return textMatch ? decodeXmlEntities(textMatch[1].trim()) : "";
}

function buildReviewLinks(vehicle: Vehicle): ResearchReviewLink[] {
  const query = encodeURIComponent(`${buildVehicleQuery(vehicle)} review`);

  return [
    {
      label: "Car and Driver review",
      url: `https://www.google.com/search?q=${query}+site%3Acaranddriver.com`
    },
    {
      label: "Edmunds review",
      url: `https://www.google.com/search?q=${query}+site%3Aedmunds.com`
    },
    {
      label: "Kelley Blue Book review",
      url: `https://www.google.com/search?q=${query}+site%3Akbb.com`
    }
  ];
}

function getChannelBias(vehicle: Vehicle, channelKey: string) {
  const isTruck = /(truck|pickup|r1t|f-150|silverado|sierra|tacoma|tundra)/i.test(
    `${vehicle.make} ${vehicle.model} ${vehicle.trim}`
  );
  const isEv = vehicle.powertrain === "ev";
  const isPerformance = /(m|amg|rs|trackhawk|zr2|raptor|hellcat|plaid)/i.test(vehicle.trim);

  if (channelKey === "doug-demuro") {
    return isEv || isPerformance ? 10 : 7;
  }

  if (channelKey === "auto-focus") {
    return isEv ? 11 : isTruck ? 6 : 7;
  }

  if (channelKey === "cars-and-bids") {
    return isPerformance || isTruck ? 9 : 6;
  }

  return 0;
}

async function fetchRecallHistory(vehicle: Vehicle) {
  try {
    const endpoint = new URL("https://api.nhtsa.gov/recalls/recallsByVehicle");
    endpoint.searchParams.set("make", vehicle.make);
    endpoint.searchParams.set("model", vehicle.model);
    endpoint.searchParams.set("modelYear", String(vehicle.year));

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 12 }
    });

    if (!response.ok) {
      return [] as RecallRecord[];
    }

    const payload = (await response.json()) as { results?: RecallRecord[] };
    return payload.results ?? [];
  } catch {
    return [] as RecallRecord[];
  }
}

function deriveIssueThemes(recalls: RecallRecord[]) {
  const componentCounts = new Map<string, number>();

  for (const recall of recalls) {
    if (!recall.component) {
      continue;
    }

    const normalized = recall.component
      .split(/,|:/)[0]
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    componentCounts.set(normalized, (componentCounts.get(normalized) ?? 0) + 1);
  }

  return [...componentCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([component, count]) => `${component.replace(/\b\w/g, (char) => char.toUpperCase())} (${count})`);
}

function classifyVideoKind(title: string, url: string) {
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (
    lowerUrl.includes("/shorts/") ||
    lowerTitle.includes("short") ||
    lowerTitle.includes("shorts") ||
    lowerTitle.includes("clip") ||
    lowerTitle.includes("clips") ||
    lowerTitle.includes("highlight")
  ) {
    return "clip" as const;
  }

  return "full" as const;
}

function isResearchVideo(video: ResearchVideo | null): video is ResearchVideo {
  return Boolean(video);
}

function parseFeedEntries(xml: string, channel: VideoChannel) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const mapped: Array<ResearchVideo | null> = entries.map((entry) => {
    const title = matchTag(entry, "title");
    const url = matchLink(entry);
    const publishedAt = matchTag(entry, "published");
    const videoId = matchTag(entry, "yt:videoId");

    if (!title || !url) {
      return null;
    }

    return {
      title,
      url,
      publishedAt,
      source: channel.label,
      channelKey: channel.key,
      thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
      kind: classifyVideoKind(title, url)
    };
  });

  return mapped.filter(isResearchVideo);
}

async function fetchChannelVideos(channel: VideoChannel) {
  try {
    const channelId = channel.channelId ?? (await resolveChannelIdFromHandle(channel.handle ?? ""));

    if (!channelId) {
      return [] as ResearchVideo[];
    }

    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { Accept: "application/xml, text/xml" },
      next: { revalidate: 60 * 60 * 6 }
    });

    if (!response.ok) {
      return [] as ResearchVideo[];
    }

    const xml = await response.text();
    const entries = parseFeedEntries(xml, channel);
    return channel.filter ? entries.filter(channel.filter) : entries;
  } catch {
    return [] as ResearchVideo[];
  }
}

async function resolveChannelIdFromHandle(handle: string) {
  if (!handle) {
    return null;
  }

  try {
    const response = await fetch(`https://www.youtube.com/${handle}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml"
      },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const match = html.match(/"channelId":"(UC[^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractInitialData(html: string) {
  const match = html.match(/var ytInitialData = (\{[\s\S]*?\});/);
  return match ? match[1] : null;
}

function collectVideoRenderers(node: unknown, results: Array<Record<string, unknown>> = []) {
  if (!node || typeof node !== "object") {
    return results;
  }

  if ("videoRenderer" in node && node.videoRenderer && typeof node.videoRenderer === "object") {
    results.push(node.videoRenderer as Record<string, unknown>);
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoRenderers(item, results);
    }
    return results;
  }

  for (const value of Object.values(node)) {
    collectVideoRenderers(value, results);
  }

  return results;
}

function rendererText(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  if ("simpleText" in value && typeof value.simpleText === "string") {
    return value.simpleText;
  }

  if ("runs" in value && Array.isArray(value.runs)) {
    return value.runs
      .map((run) => (run && typeof run === "object" && "text" in run && typeof run.text === "string" ? run.text : ""))
      .join("")
      .trim();
  }

  return "";
}

function parseSearchResults(html: string, channel: VideoChannel) {
  const json = extractInitialData(html);

  if (!json) {
    return [] as ResearchVideo[];
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    const renderers = collectVideoRenderers(parsed);
    const mapped: Array<ResearchVideo | null> = renderers.map((renderer) => {
      const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
      const title = rendererText(renderer.title);
      const publishedAt = rendererText(renderer.publishedTimeText) || "";

      if (!videoId || !title) {
        return null;
      }

      return {
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt,
        source: channel.label,
        channelKey: channel.key,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        kind: classifyVideoKind(title, `https://www.youtube.com/watch?v=${videoId}`)
      };
    });

    return mapped.filter(isResearchVideo);
  } catch {
    return [] as ResearchVideo[];
  }
}

function filterVideosForVehicle(vehicle: Vehicle, videos: ResearchVideo[]) {
  const tokens = [
    vehicle.make.toLowerCase(),
    vehicle.model.toLowerCase(),
    `${vehicle.make} ${vehicle.model}`.toLowerCase()
  ];

  return videos.filter((video) => {
    const title = video.title.toLowerCase();
    return title.includes(tokens[2]) || (title.includes(tokens[0]) && title.includes(tokens[1]));
  });
}

function scoreVehicleVideo(vehicle: Vehicle, video: ResearchVideo) {
  const title = video.title.toLowerCase();
  const make = vehicle.make.toLowerCase();
  const model = vehicle.model.toLowerCase();
  const trim = vehicle.trim.toLowerCase();
  const year = String(vehicle.year);
  let score = getChannelBias(vehicle, video.channelKey);

  if (title.includes(`${make} ${model}`)) {
    score += 24;
  }

  if (title.includes(make) && title.includes(model)) {
    score += 16;
  }

  if (trim && trim.length > 1 && title.includes(trim)) {
    score += 6;
  }

  if (title.includes(year)) {
    score += 4;
  }

  if (title.includes("review") || title.includes("drive") || title.includes("tour")) {
    score += 3;
  }

  if (title.includes("vs ") || title.includes("comparison")) {
    score -= 4;
  }

  if (title.includes("short") || title.includes("clip")) {
    score -= 2;
  }

  return score;
}

async function searchChannelVideos(vehicle: Vehicle, channel: VideoChannel) {
  const query = encodeURIComponent(`${vehicle.make} ${vehicle.model}`);
  const baseUrl = channel.handle
    ? `https://www.youtube.com/${channel.handle}/search?query=${query}`
    : channel.channelId
      ? `https://www.youtube.com/channel/${channel.channelId}/search?query=${query}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${channel.label} ${vehicle.make} ${vehicle.model}`)}`;

  try {
    const response = await fetch(baseUrl, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      return [] as ResearchVideo[];
    }

    const html = await response.text();
    const parsed = parseSearchResults(html, channel);
    return channel.filter ? parsed.filter(channel.filter) : parsed;
  } catch {
    return [] as ResearchVideo[];
  }
}

export async function getHomepageVideoFeed() {
  const videosByChannel = await Promise.all(VIDEO_CHANNELS.map(fetchChannelVideos));
  const seenUrls = new Set<string>();
  const deduped = videosByChannel
    .flat()
    .filter((video) => {
      if (seenUrls.has(video.url)) {
        return false;
      }

      seenUrls.add(video.url);
      return true;
    });

  return {
    channels: VIDEO_CHANNELS.map((channel) => ({ key: channel.key, label: channel.label })),
    videos: deduped
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
      .slice(0, 18)
  };
}

export async function getVehicleResearch(vehicle: Vehicle): Promise<VehicleResearch> {
  const [recalls, feedVideosByChannel, searchedVideosByChannel] = await Promise.all([
    fetchRecallHistory(vehicle),
    Promise.all(VIDEO_CHANNELS.map(fetchChannelVideos)),
    Promise.all(VIDEO_CHANNELS.map((channel) => searchChannelVideos(vehicle, channel)))
  ]);

  const seenUrls = new Set<string>();
  const mergedVideos = [...feedVideosByChannel.flat(), ...searchedVideosByChannel.flat()].filter((video) => {
    if (seenUrls.has(video.url)) {
      return false;
    }

    seenUrls.add(video.url);
    return true;
  });

  const rankedVideos = filterVideosForVehicle(vehicle, mergedVideos)
    .sort((left, right) => scoreVehicleVideo(vehicle, right) - scoreVehicleVideo(vehicle, left))
    .slice(0, 6);

  return {
    recallCount: recalls.length,
    recentRecalls: recalls
      .slice()
      .sort((left, right) => (right.reportReceivedDate ?? "").localeCompare(left.reportReceivedDate ?? ""))
      .slice(0, 3),
    commonIssueThemes: deriveIssueThemes(recalls),
    reviewLinks: buildReviewLinks(vehicle),
    videos: rankedVideos
  };
}
