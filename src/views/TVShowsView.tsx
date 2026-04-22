import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCachedSeries, setCachedSeries } from "../store";
import { useAccount } from "../hooks/useAccount";
import type { Account, Series, Episode, SeriesInfoData } from "../types";

const VISIBLE_STEP = 60;

// ─── Episode row ───────────────────────────────────────────────

function EpisodeRow({ ep }: { ep: Episode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(ep.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [ep.url]);

  const handleVlc = useCallback(() => {
    invoke("play_vlc", { url: ep.url }).catch(console.error);
  }, [ep.url]);

  const handlePlay = useCallback(() => {
    invoke("play_in_app", { url: ep.url }).catch(console.error);
  }, [ep.url]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors">
      {/* Thumbnail */}
      <div className="w-20 h-12 rounded-lg bg-gray-800 shrink-0 overflow-hidden flex items-center justify-center">
        {ep.info?.movie_image ? (
          <img
            src={ep.info.movie_image}
            alt={ep.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-5 h-5 text-gray-700"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">
          <span className="text-gray-500 mr-1.5">E{ep.episode_num}</span>
          {ep.title || `Episode ${ep.episode_num}`}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {ep.info?.duration && (
            <span className="text-[10px] text-gray-600">
              {ep.info.duration}
            </span>
          )}
          {ep.info?.releasedate && (
            <span className="text-[10px] text-gray-600">
              {ep.info.releasedate}
            </span>
          )}
          {ep.info?.rating && (
            <span className="text-[10px] text-yellow-500">
              ★ {ep.info.rating}
            </span>
          )}
        </div>
        {ep.info?.plot && (
          <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">
            {ep.info.plot}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          onClick={handlePlay}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 h-auto"
          title="Play in built-in player"
        >
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play
        </Button>
        <Button
          onClick={handleVlc}
          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 h-auto"
          title="Play in VLC"
        >
          <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          VLC
        </Button>
        <Button
          onClick={handleCopy}
          className="rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 h-auto"
          title="Copy URL"
        >
          {copied ? (
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              className="w-3 h-3"
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
      </div>
    </div>
  );
}

// ─── Series detail modal ───────────────────────────────────────

function SeriesModal({
  series,
  account,
  onClose,
}: {
  series: Series;
  account: Account;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<SeriesInfoData | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<string>("");

  useEffect(() => {
    setInfo(null);
    setInfoLoading(true);
    setInfoError(null);
    invoke<SeriesInfoData>("get_series_info", {
      serverUrl: account.serverUrl,
      username: account.username,
      password: account.password,
      seriesId: series.seriesId,
    })
      .then((data) => {
        setInfo(data);
        const keys = Object.keys(data.episodes ?? {}).sort(
          (a, b) => parseInt(a) - parseInt(b),
        );
        if (keys.length > 0) setActiveSeason(keys[0]);
      })
      .catch((e) => setInfoError(String(e)))
      .finally(() => setInfoLoading(false));
  }, [series.seriesId]);

  const seasonKeys = useMemo(
    () =>
      Object.keys(info?.episodes ?? {}).sort(
        (a, b) => parseInt(a) - parseInt(b),
      ),
    [info],
  );

  const episodes: Episode[] = info?.episodes?.[activeSeason] ?? [];

  const plot = series.plot || ((info?.info?.plot as string) ?? "");
  const genre = series.genre || ((info?.info?.genre as string) ?? "");
  const cast = series.cast || ((info?.info?.cast as string) ?? "");
  const director = series.director || ((info?.info?.director as string) ?? "");
  const cover =
    (info?.info?.cover_big as string) ||
    (info?.info?.cover as string) ||
    series.cover;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Series header */}
        <div className="shrink-0 flex gap-0">
          {cover && (
            <div className="w-36 shrink-0 bg-gray-800">
              <img
                src={cover}
                alt={series.name}
                className="w-full h-full object-cover"
                style={{ maxHeight: "200px" }}
              />
            </div>
          )}
          <div className="flex-1 p-5 min-w-0 border-b border-gray-800">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-white font-bold text-xl leading-tight truncate">
                  {series.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {series.year && (
                    <span className="text-xs text-gray-400">{series.year}</span>
                  )}
                  {series.rating &&
                    !isNaN(parseFloat(series.rating)) &&
                    parseFloat(series.rating) > 0 && (
                      <span className="text-xs text-yellow-400">
                        ★ {parseFloat(series.rating).toFixed(1)}
                      </span>
                    )}
                  {series.episodeRunTime && (
                    <span className="text-xs text-gray-500">
                      {series.episodeRunTime} min/ep
                    </span>
                  )}
                  {genre && (
                    <span className="text-xs text-gray-500 truncate max-w-xs">
                      {genre}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {(director || cast) && (
              <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                {director && (
                  <p>
                    <span className="text-gray-600">Director: </span>
                    {director}
                  </p>
                )}
                {cast && (
                  <p className="truncate">
                    <span className="text-gray-600">Cast: </span>
                    {cast}
                  </p>
                )}
              </div>
            )}
            {plot && (
              <p className="mt-2 text-xs text-gray-400 leading-relaxed line-clamp-3">
                {plot}
              </p>
            )}
          </div>
        </div>

        {/* Episodes area */}
        {infoLoading ? (
          <div className="flex items-center justify-center py-10 gap-3 text-blue-400">
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
            <span className="text-sm text-gray-400">Loading episodes…</span>
          </div>
        ) : infoError ? (
          <div className="px-5 py-4 text-sm text-red-400">{infoError}</div>
        ) : (
          <>
            {/* Season tabs */}
            {seasonKeys.length > 0 && (
              <div className="shrink-0 border-b border-gray-800 px-4 py-2 flex gap-2 overflow-x-auto">
                {seasonKeys.map((sk) => (
                  <button
                    key={sk}
                    onClick={() => setActiveSeason(sk)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeSeason === sk
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    Season {sk}
                  </button>
                ))}
              </div>
            )}

            {/* Episode list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
              {episodes.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p className="text-gray-600 text-sm">
                    No episodes available.
                  </p>
                </div>
              ) : (
                episodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} />)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Series card ───────────────────────────────────────────────

function SeriesCard({
  series,
  onClick,
}: {
  series: Series;
  onClick: () => void;
}) {
  const rating = series.rating ? parseFloat(series.rating) : null;
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-blue-500/50 transition-all duration-150 cursor-pointer"
    >
      <div className="aspect-2/3 w-full bg-gray-800 relative overflow-hidden">
        {series.cover ? (
          <img
            src={series.cover}
            alt={series.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-gray-700"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
        )}
        {rating !== null && !isNaN(rating) && rating > 0 && (
          <div className="absolute top-1.5 right-1.5 bg-black/75 rounded px-1.5 py-0.5 text-[10px] text-yellow-400 font-semibold">
            ★ {rating.toFixed(1)}
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-white truncate leading-tight">
          {series.name}
        </p>
        {series.year && (
          <p className="text-[10px] text-gray-500 mt-0.5">{series.year}</p>
        )}
      </div>
    </button>
  );
}

// ─── TV Shows view ─────────────────────────────────────────────

export default function TVShowsView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account, loading: accountLoading } = useAccount(id);

  const [allSeries, setAllSeries] = useState<Series[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("Initializing…");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);

  useEffect(() => {
    if (accountLoading || !account) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<string>("progress", (e) => setProgress(e.payload)).then(
      (fn) => (unlisten = fn),
    );

    (async () => {
      try {
        const cached = await getCachedSeries(account.id);
        if (cached && !cancelled) {
          setAllSeries(cached.series);
          setFetchedAt(cached.fetchedAt);
          setLoading(false);
          return;
        }
      } catch {
        // cache miss — continue
      }

      try {
        const series = await invoke<Series[]>("get_series", {
          serverUrl: account.serverUrl,
          username: account.username,
          password: account.password,
        });
        if (cancelled) return;
        let storedAt = new Date().toISOString();
        try {
          storedAt = await setCachedSeries(account.id, series);
        } catch {
          // cache write failed (e.g. migration pending) — continue without caching
        }
        setAllSeries(series);
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

  const handleRefresh = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const series = await invoke<Series[]>("get_series", {
        serverUrl: account.serverUrl,
        username: account.username,
        password: account.password,
      });
      let storedAt = new Date().toISOString();
      try {
        storedAt = await setCachedSeries(account.id, series);
      } catch {
        // cache write failed — continue
      }
      setAllSeries(series);
      setFetchedAt(storedAt);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [account]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allSeries.filter((s) => {
      if (activeGroup && s.group !== activeGroup) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term);
    });
  }, [allSeries, activeGroup, searchTerm]);

  const groups = useMemo(() => {
    const all = [...new Set(allSeries.map((s) => s.group))].sort((a, b) =>
      a.localeCompare(b),
    );
    return groupSearch
      ? all.filter((g) => g.toLowerCase().includes(groupSearch.toLowerCase()))
      : all;
  }, [allSeries, groupSearch]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allSeries.forEach((s) => {
      counts[s.group] = (counts[s.group] || 0) + 1;
    });
    return counts;
  }, [allSeries]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (accountLoading) {
    return (
      <div className="bg-gray-950 h-screen flex items-center justify-center">
        <svg
          className="animate-spin h-6 w-6 text-blue-500"
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
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
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
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-400">{account?.name}</span>
          <span className="text-gray-600">›</span>
          <span className="text-white font-semibold">TV Shows</span>
        </div>
        <div className="flex-1 max-w-sm ml-auto">
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(VISIBLE_STEP);
            }}
            placeholder="Search TV shows…"
            className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-8 text-sm"
          />
        </div>
        {fetchedAt && (
          <span className="text-[10px] text-gray-600 hidden lg:block shrink-0">
            {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-40 shrink-0"
          title="Refresh"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-800">
            <Input
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Filter categories…"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-7 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <button
              onClick={() => {
                setActiveGroup(null);
                setVisibleCount(VISIBLE_STEP);
              }}
              className={`w-full text-left px-3 py-2 text-xs flex justify-between items-center transition-colors ${
                !activeGroup
                  ? "text-white bg-blue-600/20 border-r-2 border-blue-500"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="truncate">All Shows</span>
              <span className="text-[10px] text-gray-600 ml-2 shrink-0">
                {allSeries.length}
              </span>
            </button>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setActiveGroup(g);
                  setVisibleCount(VISIBLE_STEP);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex justify-between items-center transition-colors ${
                  activeGroup === g
                    ? "text-white bg-blue-600/20 border-r-2 border-blue-500"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <span className="truncate">{g}</span>
                <span className="text-[10px] text-gray-600 ml-2 shrink-0">
                  {groupCounts[g] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <svg
                className="animate-spin h-6 w-6 text-blue-500"
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
              <p className="text-sm text-gray-500">{progress}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
              <p className="text-red-400 text-sm text-center">{error}</p>
              <Button
                onClick={handleRefresh}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
              >
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600 text-sm">No TV shows found.</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {visible.map((s) => (
                  <SeriesCard
                    key={s.seriesId}
                    series={s}
                    onClick={() => setSelectedSeries(s)}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6 pb-4">
                  <Button
                    onClick={() => setVisibleCount((n) => n + VISIBLE_STEP)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-6 py-2 rounded-lg"
                  >
                    Load more ({filtered.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Series detail modal */}
      {selectedSeries && account && (
        <SeriesModal
          series={selectedSeries}
          account={account}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </div>
  );
}
