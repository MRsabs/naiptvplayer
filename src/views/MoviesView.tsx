import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCachedMovies, setCachedMovies } from "../store";
import { useAccount } from "../hooks/useAccount";
import type { Account, Movie } from "../types";

const VISIBLE_STEP = 80;

// ─── Movie card ────────────────────────────────────────────────

function MovieCard({ movie, onClick }: { movie: Movie; onClick: () => void }) {
  const rating = movie.rating ? parseFloat(movie.rating) : null;
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-blue-500/50 transition-all duration-150 cursor-pointer"
    >
      <div className="aspect-2/3 w-full bg-gray-800 relative overflow-hidden">
        {movie.cover ? (
          <img
            src={movie.cover}
            alt={movie.name}
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
              <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
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
          {movie.name}
        </p>
        {movie.year && (
          <p className="text-[10px] text-gray-500 mt-0.5">{movie.year}</p>
        )}
      </div>
    </button>
  );
}

// ─── Movie detail modal ────────────────────────────────────────

function MovieModal({
  movie,
  account,
  onClose,
}: {
  movie: Movie;
  account: Account;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInfo(null);
    setInfoLoading(true);
    invoke<Record<string, unknown>>("get_vod_info", {
      serverUrl: account.serverUrl,
      username: account.username,
      password: account.password,
      vodId: movie.streamId,
    })
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false));
  }, [movie.streamId]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(movie.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [movie.url]);

  const handleVlc = useCallback(() => {
    invoke("play_vlc", { url: movie.url }).catch(console.error);
  }, [movie.url]);

  const handlePlay = useCallback(() => {
    invoke("play_in_app", { url: movie.url }).catch(console.error);
  }, [movie.url]);

  const rawInfo = (info?.info ?? {}) as Record<string, unknown>;
  const plot = (rawInfo.plot as string) || "";
  const cast = (rawInfo.cast as string) || "";
  const director = (rawInfo.director as string) || "";
  const genre = (rawInfo.genre as string) || "";
  const duration = (rawInfo.duration as string) || "";
  const rating = (rawInfo.rating as string) || movie.rating || "";
  const year =
    ((rawInfo.releasedate as string) || "").slice(0, 4) || movie.year || "";
  const cover =
    (rawInfo.cover_big as string) ||
    (rawInfo.movie_image as string) ||
    movie.cover;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Poster */}
          <div className="w-48 shrink-0 bg-gray-800 relative">
            {cover ? (
              <img
                src={cover}
                alt={movie.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-gray-700"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-800">
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-xl leading-tight">
                  {movie.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {year && (
                    <span className="text-xs text-gray-400">{year}</span>
                  )}
                  {rating && !isNaN(parseFloat(rating)) && (
                    <span className="text-xs text-yellow-400">
                      ★ {parseFloat(rating).toFixed(1)}
                    </span>
                  )}
                  {genre && (
                    <span className="text-xs text-gray-500 truncate max-w-xs">
                      {genre}
                    </span>
                  )}
                  {duration && (
                    <span className="text-xs text-gray-500">{duration}</span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors ml-2 shrink-0"
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {infoLoading && (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <svg
                    className="animate-spin h-4 w-4"
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
                  Loading details…
                </div>
              )}
              {director && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">
                    Director
                  </p>
                  <p className="text-sm text-gray-300">{director}</p>
                </div>
              )}
              {cast && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">
                    Cast
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {cast}
                  </p>
                </div>
              )}
              {plot && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5">
                    Plot
                  </p>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {plot}
                  </p>
                </div>
              )}
              {!infoLoading && !plot && !cast && !director && (
                <p className="text-sm text-gray-600">
                  No additional details available.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-gray-800 flex items-center gap-3">
              <Button
                onClick={handlePlay}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </Button>
              <Button
                onClick={handleVlc}
                className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                VLC
              </Button>
              <Button
                onClick={handleCopy}
                className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2"
              >
                {copied ? (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
                {copied ? "Copied!" : "Copy URL"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Movies view ───────────────────────────────────────────────

export default function MoviesView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account, loading: accountLoading } = useAccount(id);

  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_STEP);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("Initializing…");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  useEffect(() => {
    if (accountLoading || !account) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<string>("progress", (e) => setProgress(e.payload)).then(
      (fn) => (unlisten = fn),
    );

    (async () => {
      try {
        const cached = await getCachedMovies(account.id);
        if (cached && !cancelled) {
          setAllMovies(cached.movies);
          setFetchedAt(cached.fetchedAt);
          setLoading(false);
          return;
        }
      } catch {
        // cache miss — continue
      }

      try {
        const movies = await invoke<Movie[]>("get_movies", {
          serverUrl: account.serverUrl,
          username: account.username,
          password: account.password,
        });
        if (cancelled) return;
        let storedAt = new Date().toISOString();
        try {
          storedAt = await setCachedMovies(account.id, movies);
        } catch {
          // cache write failed (e.g. migration pending) — continue without caching
        }
        setAllMovies(movies);
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
      const movies = await invoke<Movie[]>("get_movies", {
        serverUrl: account.serverUrl,
        username: account.username,
        password: account.password,
      });
      let storedAt = new Date().toISOString();
      try {
        storedAt = await setCachedMovies(account.id, movies);
      } catch {
        // cache write failed — continue
      }
      setAllMovies(movies);
      setFetchedAt(storedAt);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [account]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allMovies.filter((m) => {
      if (activeGroup && m.group !== activeGroup) return false;
      if (!term) return true;
      return m.name.toLowerCase().includes(term);
    });
  }, [allMovies, activeGroup, searchTerm]);

  const groups = useMemo(() => {
    const all = [...new Set(allMovies.map((m) => m.group))].sort((a, b) =>
      a.localeCompare(b),
    );
    return groupSearch
      ? all.filter((g) => g.toLowerCase().includes(groupSearch.toLowerCase()))
      : all;
  }, [allMovies, groupSearch]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allMovies.forEach((m) => {
      counts[m.group] = (counts[m.group] || 0) + 1;
    });
    return counts;
  }, [allMovies]);

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
          <span className="text-white font-semibold">Movies</span>
        </div>
        <div className="flex-1 max-w-sm ml-auto">
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setVisibleCount(VISIBLE_STEP);
            }}
            placeholder="Search movies…"
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
              <span className="truncate">All Movies</span>
              <span className="text-[10px] text-gray-600 ml-2 shrink-0">
                {allMovies.length}
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
              <p className="text-gray-600 text-sm">No movies found.</p>
            </div>
          ) : (
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {visible.map((movie) => (
                  <MovieCard
                    key={movie.streamId}
                    movie={movie}
                    onClick={() => setSelectedMovie(movie)}
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

      {/* Movie detail modal */}
      {selectedMovie && account && (
        <MovieModal
          movie={selectedMovie}
          account={account}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  );
}
