import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAccount } from "../hooks/useAccount";
import { getAccountSettings, saveAccountSettings } from "../store";
import type { AccountSettings, StreamFormat } from "../types";

const STREAM_FORMATS: {
  value: StreamFormat;
  label: string;
  description: string;
}[] = [
  {
    value: "ts",
    label: "MPEG-TS (.ts)",
    description: "Standard transport stream, best compatibility",
  },
  {
    value: "m3u8",
    label: "HLS (.m3u8)",
    description: "HTTP Live Streaming, adaptive bitrate",
  },
];

function SettingsModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<AccountSettings>({
    streamFormat: "ts",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAccountSettings(accountId).then(setSettings);
  }, [accountId]);

  const handleSave = async () => {
    setSaving(true);
    await saveAccountSettings(accountId, settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
            <h2 className="text-white font-semibold text-lg">
              Account Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
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

        {/* Stream format */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-3">
            Live TV Stream Format
          </label>
          <div className="space-y-2">
            {STREAM_FORMATS.map((fmt) => (
              <button
                key={fmt.value}
                onClick={() =>
                  setSettings({ ...settings, streamFormat: fmt.value })
                }
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 ${
                  settings.streamFormat === fmt.value
                    ? "border-blue-500 bg-blue-500/10 text-white"
                    : "border-gray-800 bg-gray-800/50 text-gray-400 hover:border-gray-700 hover:text-white"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.streamFormat === fmt.value
                      ? "border-blue-400"
                      : "border-gray-600"
                  }`}
                >
                  {settings.streamFormat === fmt.value && (
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-sm">{fmt.label}</div>
                  <div className="text-xs text-gray-500">{fmt.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* URL preview */}
        <div className="mb-6 rounded-xl bg-gray-800/60 border border-gray-700/50 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Live TV URL format</div>
          <code className="text-xs text-green-400 break-all">
            {`{server}/live/{user}/{pass}/{stream_id}.${settings.streamFormat}`}
          </code>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-700 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account, loading } = useAccount(id);
  const [showSettings, setShowSettings] = useState(false);

  if (loading) {
    return (
      <div className="bg-gray-950 h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

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

  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          title="Back to accounts"
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
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
            <path d="M10 8.65L15.5 12 10 15.35z" />
          </svg>
          <span className="font-semibold text-white">{account.name}</span>
        </div>
        <span className="text-xs text-gray-600">{account.serverUrl}</span>
      </header>

      {/* Tiles */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="grid grid-cols-2 gap-6 w-full max-w-xl">
          {/* Live TV */}
          <button
            onClick={() => navigate(`/account/${id}/livetv`)}
            className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 transition-all duration-150 bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-blue-500/50 cursor-pointer text-white"
          >
            <div className="text-blue-400">
              <svg
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                <path d="M10 8.65L15.5 12 10 15.35z" />
              </svg>
            </div>
            <span className="font-semibold text-base">Live TV</span>
          </button>

          {/* Movies */}
          <button
            onClick={() => navigate(`/account/${id}/movies`)}
            className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 transition-all duration-150 bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-blue-500/50 cursor-pointer text-white"
          >
            <div className="text-blue-400">
              <svg
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
              </svg>
            </div>
            <span className="font-semibold text-base">Movies</span>
          </button>

          {/* TV Shows */}
          <button
            onClick={() => navigate(`/account/${id}/tvshows`)}
            className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 transition-all duration-150 bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-blue-500/50 cursor-pointer text-white"
          >
            <div className="text-blue-400">
              <svg
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <span className="font-semibold text-base">TV Shows</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="relative flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 transition-all duration-150 bg-gray-900 border-gray-800 hover:bg-gray-800 hover:border-purple-500/50 cursor-pointer text-white"
          >
            <div className="text-purple-400">
              <svg
                className="w-10 h-10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </div>
            <span className="font-semibold text-base">Settings</span>
          </button>
        </div>
      </main>

      {showSettings && id && (
        <SettingsModal accountId={id} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
