"use client";

import { useMemo, useState } from "react";
import { ResearchVideo } from "@/lib/research";

interface HomeVideoFeedProps {
  channels: Array<{ key: string; label: string }>;
  videos: ResearchVideo[];
}

export function HomeVideoFeed({ channels, videos }: HomeVideoFeedProps) {
  const [activeChannel, setActiveChannel] = useState<string>("all");

  const visibleVideos = useMemo(
    () => (activeChannel === "all" ? videos : videos.filter((video) => video.channelKey === activeChannel)),
    [activeChannel, videos]
  );
  const [fullLengthVideos, clipVideos] = useMemo(() => {
    const clips = visibleVideos.filter((video) => video.kind === "clip");
    const fullLength = visibleVideos.filter((video) => video.kind === "full");
    return [fullLength, clips];
  }, [visibleVideos]);

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Video feed</span>
          <h2>Garage video research</h2>
        </div>
        <p>Keep a broader stream of channel content on the homepage, then show only exact vehicle matches on detail pages.</p>
      </div>

      <div className="garage-filter-bar">
        <button
          type="button"
          className={`garage-filter-tab ${activeChannel === "all" ? "garage-filter-tab--active" : ""}`}
          onClick={() => setActiveChannel("all")}
        >
          <span>All channels</span>
          <strong>{videos.length}</strong>
        </button>
        {channels.map((channel) => {
          const count = videos.filter((video) => video.channelKey === channel.key).length;

          return (
            <button
              key={channel.key}
              type="button"
              className={`garage-filter-tab ${activeChannel === channel.key ? "garage-filter-tab--active" : ""}`}
              onClick={() => setActiveChannel(channel.key)}
            >
              <span>{channel.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      {visibleVideos.length > 0 ? (
        <div className="stack">
          <div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Full length</span>
                <h2>Long-form reviews and walkarounds</h2>
              </div>
              <p>Broader uploads from the selected feeds.</p>
            </div>
            {fullLengthVideos.length > 0 ? (
              <div className="video-feed-grid">
                {fullLengthVideos.map((video) => (
                  <a key={video.url} href={video.url} target="_blank" rel="noreferrer" className="card video-feed-card">
                    {video.thumbnailUrl ? (
                      <div className="video-feed-card__thumb" style={{ backgroundImage: `url(${video.thumbnailUrl})` }} />
                    ) : null}
                    <div className="video-feed-card__body">
                      <div className="video-feed-card__meta">
                        <span className="eyebrow">{video.source}</span>
                        <span className="status-pill status-live">{video.publishedAt.slice(0, 10)}</span>
                      </div>
                      <h3>{video.title}</h3>
                      <p>Open on YouTube</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="card empty-panel">
                <p className="empty-state">No full-length videos available for this channel yet.</p>
              </div>
            )}
          </div>

          <div>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Clips</span>
                <h2>Short-form clips and highlights</h2>
              </div>
              <p>Uses explicit clip detection from video URLs and titles, including YouTube Shorts.</p>
            </div>
            {clipVideos.length > 0 ? (
              <div className="video-feed-grid">
                {clipVideos.map((video) => (
                  <a key={video.url} href={video.url} target="_blank" rel="noreferrer" className="card video-feed-card">
                    {video.thumbnailUrl ? (
                      <div className="video-feed-card__thumb" style={{ backgroundImage: `url(${video.thumbnailUrl})` }} />
                    ) : null}
                    <div className="video-feed-card__body">
                      <div className="video-feed-card__meta">
                        <span className="eyebrow">{video.source}</span>
                        <span className="status-pill status-upcoming">{video.publishedAt.slice(0, 10)}</span>
                      </div>
                      <h3>{video.title}</h3>
                      <p>Open on YouTube</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="card empty-panel">
                <p className="empty-state">No clips available for this channel yet.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card empty-panel">
          <p className="empty-state">No videos available for this channel yet.</p>
        </div>
      )}
    </section>
  );
}
