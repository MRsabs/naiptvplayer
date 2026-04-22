import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCachedChannels,
  setCachedChannels,
  getAccountSettings,
} from "../store";
import { useAccount } from "../hooks/useAccount";
import type { Channel } from "../types";

// ─── Channel card ──────────────────────────────────────────────

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [url]);

  return (
    <Button
      onClick={handleCopy}
      className="shrink-0 rounded-lg bg-gray-700 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-600"
      title="Copy stream URL"
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </Button>
  );
}

function ChannelCard({
  channel,
  onVlc,
  onPlay,
}: {
  channel: Channel;
  onVlc: (url: string) => void;
  onPlay: (url: string) => void;
}) {
  return (
    <div className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2.5 flex items-center gap-3 transition-all duration-150">
      <div className="w-14 h-10 shrink-0 bg-gray-800 rounded flex items-center justify-center overflow-hidden">
        {channel.logo ? (
          <img
            src={channel.logo}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = "none";
              const fallback = document.createElement("span");
              fallback.className = "text-gray-600 text-xl";
              fallback.textContent = "📺";
              target.parentNode?.appendChild(fallback);
            }}
          />
        ) : (
          <span className="text-gray-600 text-xl">📺</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-white truncate">
          {channel.name}
        </div>
        <div className="text-[11px] text-gray-600 truncate">
          {channel.group}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <CopyButton url={channel.url} />
        <Button
          onClick={() => onPlay(channel.url)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          title="Play in built-in player"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play
        </Button>
        <Button
          onClick={() => onVlc(channel.url)}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          title="Play in VLC"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          VLC
        </Button>
      </div>
    </div>
  );
}

// ─── Live TV view ──────────────────────────────────────────────

export default function LiveTVView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account, loading: accountLoading } = useAccount(id);

  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("Initializing…");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [vlcError, setVlcError] = useState<string | null>(null);

  useEffect(() => {
    if (accountLoading || !account) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<string>("progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    (async () => {
      // 1. Check SQLite cache first
      try {
        const cached = await getCachedChannels(account.id);
        if (cached && !cancelled) {
          setAllChannels(cached.channels);
          setFetchedAt(cached.fetchedAt);
          setLoading(false);
          return;
        }
      } catch {
        // cache miss — proceed to fetch
      }

      // 2. Load settings for stream format
      const settings = await getAccountSettings(account.id);

      // 3. Fetch from API
      try {
        const channels = await invoke<Channel[]>("get_channels", {
          serverUrl: account.serverUrl,
          username: account.username,
          password: account.password,
          streamFormat: settings.streamFormat,
        });
        if (cancelled) return;
        const storedAt = await setCachedChannels(account.id, channels);
        setAllChannels(channels);
        setFetchedAt(storedAt);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [accountLoading, account?.id]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allChannels.filter((ch) => {
      if (activeGroup && ch.group !== activeGroup) return false;
      if (!term) return true;
      if (ch.name.toLowerCase().includes(term)) return true;
      if (ch.group.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [allChannels, activeGroup, searchTerm]);

  const groups = useMemo(() => {
    const all = [...new Set(allChannels.map((c) => c.group))].sort((a, b) =>
      a.localeCompare(b),
    );
    return groupSearch
      ? all.filter((g) => g.toLowerCase().includes(groupSearch.toLowerCase()))
      : all;
  }, [allChannels, groupSearch]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allChannels.forEach((ch) => {
      counts[ch.group] = (counts[ch.group] || 0) + 1;
    });
    return counts;
  }, [allChannels]);

  const handleVlc = async (url: string) => {
    setVlcError(null);
    try {
      await invoke("play_vlc", { url });
    } catch (err) {
      setVlcError(String(err));
      setTimeout(() => setVlcError(null), 5000);
    }
  };

  const handlePlay = async (url: string) => {
    setVlcError(null);
    try {
      await invoke("play_in_app", { url });
    } catch (err) {
      setVlcError(String(err));
      setTimeout(() => setVlcError(null), 5000);
    }
  };

  const handleGroupSelect = (g: string | null) => {
    setActiveGroup(g);
    setVisibleCount(100);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setVisibleCount(100);
  };

  if (!account) {
    return (
      <div className="bg-gray-950 h-screen flex items-center justify-center text-gray-500">
        Account not found.{" "}
        <button
          onClick={() => navigate("/")}
          className="text-blue-400 ml-2 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  if (loading || error) {
    return (
      <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(`/account/${id}`)}
            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="font-semibold text-white">{account.name}</span>
          <span className="text-gray-500 text-sm">› Live TV</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          {error ? (
            <div className="text-center max-w-md px-6">
              <div className="text-red-400 text-base mb-2">⚠ {error}</div>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                }}
                className="text-blue-400 text-sm hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-blue-400">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm">{progress}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const cacheAge = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60_000)
    : null;

  const visibleChannels = filtered.slice(0, visibleCount);

  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-5 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate(`/account/${id}`)}
          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="flex items-center gap-1.5 shrink-0 text-sm">
          <span className="text-gray-400">{account.name}</span>
          <span className="text-gray-600">›</span>
          <span className="text-white font-semibold">Live TV</span>
        </div>

        <div className="flex-1 max-w-xl relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
            />
          </svg>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search channels or groups…"
            className="h-auto w-full rounded-lg border-gray-700 bg-gray-800 py-2 pr-10 pl-10 text-sm text-white placeholder:text-gray-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/40"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          )}
        </div>

        <div className="text-xs text-gray-500 shrink-0">
          {allChannels.length.toLocaleString()} channels
          {cacheAge !== null ? ` · cached ${cacheAge}m ago` : ""}
        </div>
      </header>

      {/* VLC error toast */}
      {vlcError && (
        <div className="absolute top-16 right-4 z-50 bg-red-900 border border-red-700 text-red-200 text-sm px-4 py-2 rounded-lg shadow-lg">
          ⚠ {vlcError}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 shrink-0">
            <Input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Filter groups…"
              className="h-auto w-full rounded-md border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus-visible:border-blue-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            <button
              onClick={() => handleGroupSelect(null)}
              className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center gap-1 transition-colors ${
                !activeGroup
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="truncate font-medium">All Channels</span>
              <span
                className={`shrink-0 ${!activeGroup ? "text-blue-200" : "text-gray-600"}`}
              >
                {allChannels.length.toLocaleString()}
              </span>
            </button>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => handleGroupSelect(g)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex justify-between items-center gap-1 transition-colors ${
                  activeGroup === g
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <span className="truncate">{g}</span>
                <span
                  className={`shrink-0 ${activeGroup === g ? "text-blue-200" : "text-gray-600"}`}
                >
                  {(groupCounts[g] || 0).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Channel list */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 sticky top-0 bg-gray-950/90 backdrop-blur-sm z-10 border-b border-gray-800/50">
            <span className="text-xs text-gray-600">
              {visibleChannels.length.toLocaleString()} /{" "}
              {filtered.length.toLocaleString()} channels
              {activeGroup ? " in group" : ""}
            </span>
          </div>
          <div className="px-4 pb-4 space-y-1.5">
            {visibleChannels.map((ch) => (
              <ChannelCard
                key={`${ch.group}::${ch.name}::${ch.url}`}
                channel={ch}
                onVlc={handleVlc}
                onPlay={handlePlay}
              />
            ))}
          </div>
          {filtered.length > visibleCount && (
            <div className="px-4 pb-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + 100)}
                className="rounded-lg border-gray-700 bg-gray-800 px-8 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
              >
                Load more
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
