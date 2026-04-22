import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccounts, saveAccount, deleteAccount } from "../store";
import type { Account } from "../types";

const EMPTY_FORM = { name: "", serverUrl: "", username: "", password: "" };

// ─── Status panel ──────────────────────────────────────────────

function StatusPanel({ data }: { data: Record<string, unknown> }) {
  const ui = (data.user_info ?? {}) as Record<string, unknown>;
  const si = (data.server_info ?? {}) as Record<string, unknown>;

  const status = String(ui.status ?? "Unknown");
  const statusColor =
    status.toLowerCase() === "active"
      ? "text-green-400 bg-green-400/10 border-green-400/20"
      : status.toLowerCase() === "expired"
        ? "text-red-400 bg-red-400/10 border-red-400/20"
        : status.toLowerCase() === "banned"
          ? "text-red-400 bg-red-400/10 border-red-400/20"
          : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";

  const expRaw = ui.exp_date;
  let expStr = "Unlimited";
  if (expRaw && expRaw !== "0" && expRaw !== null) {
    const ts = Number(expRaw);
    if (!isNaN(ts) && ts > 0) {
      expStr = new Date(ts * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else {
      expStr = String(expRaw);
    }
  }

  const formats = Array.isArray(ui.allowed_output_formats)
    ? (ui.allowed_output_formats as string[])
    : [];

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-white text-right">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      {/* Status badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">Status</span>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColor}`}
        >
          {status}
        </span>
      </div>

      {/* User info */}
      <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-4 divide-y divide-gray-800">
        {row("Username", String(ui.username ?? "—"))}
        {row("Expiry", expStr)}
        {row(
          "Connections",
          `${ui.active_cons ?? 0} / ${ui.max_connections ?? "—"} active`,
        )}
        {row("Trial", ui.is_trial === "1" ? "Yes" : "No")}
        {formats.length > 0 &&
          row(
            "Output formats",
            <span className="flex flex-wrap gap-1 justify-end">
              {formats.map((f) => (
                <span
                  key={f}
                  className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px] uppercase font-mono"
                >
                  {f}
                </span>
              ))}
            </span>,
          )}
      </div>

      {/* Server info */}
      {Object.keys(si).length > 0 && (
        <>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold pt-3 pb-1">
            Server
          </p>
          <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-4 divide-y divide-gray-800">
            {si.url != null && row("URL", `${si.url}:${si.port ?? ""}`)}
            {si.server_protocol != null &&
              row("Protocol", String(si.server_protocol).toUpperCase())}
            {si.timezone != null && row("Timezone", String(si.timezone))}
            {si.time_now != null && row("Server time", String(si.time_now))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Account form ──────────────────────────────────────────────

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Account>;
  onSave: (a: Account) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });

  const set =
    (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.name.trim() &&
    form.serverUrl.trim() &&
    form.username.trim() &&
    form.password.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      serverUrl: form.serverUrl.trim(),
      username: form.username.trim(),
      password: form.password.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Account name</label>
        <Input
          value={form.name}
          onChange={set("name")}
          placeholder="My IPTV"
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Server URL</label>
        <Input
          value={form.serverUrl}
          onChange={set("serverUrl")}
          placeholder="http://example.com:8080"
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Username</label>
        <Input
          value={form.username}
          onChange={set("username")}
          placeholder="username"
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Password</label>
        <Input
          type="password"
          value={form.password}
          onChange={set("password")}
          placeholder="••••••••"
          className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
          autoComplete="new-password"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={!valid}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
        >
          {initial?.id ? "Save changes" : "Add account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="flex-1 border border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function AccountsView() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [modal, setModal] = useState<"add" | Account | null>(null);
  const [statusTarget, setStatusTarget] = useState<Account | null>(null);
  const [statusData, setStatusData] = useState<Record<string, unknown> | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    getAccounts()
      .then(setAccounts)
      .finally(() => setAccountsLoading(false));
  }, []);

  useEffect(() => {
    if (!statusTarget) return;
    setStatusData(null);
    setStatusError(null);
    setStatusLoading(true);
    invoke<Record<string, unknown>>("get_account_status", {
      serverUrl: statusTarget.serverUrl,
      username: statusTarget.username,
      password: statusTarget.password,
    })
      .then(setStatusData)
      .catch((e) => setStatusError(String(e)))
      .finally(() => setStatusLoading(false));
  }, [statusTarget?.id]);

  const closeStatus = () => {
    setStatusTarget(null);
    setStatusData(null);
    setStatusError(null);
  };

  const refresh = () => {
    getAccounts().then(setAccounts);
  };

  const handleSave = async (a: Account) => {
    await saveAccount(a);
    refresh();
    setModal(null);
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(id);
    refresh();
  };

  return (
    <div className="bg-gray-950 text-gray-100 h-screen flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="shrink-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-blue-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
            <path d="M10 8.65L15.5 12 10 15.35z" />
          </svg>
          <span className="text-base font-bold text-white tracking-tight">
            NAiptvplayer
          </span>
        </div>
        <Button
          onClick={() => setModal("add")}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg"
        >
          + Add account
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        {accountsLoading ? (
          <div className="flex items-center justify-center h-full">
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
              <span className="text-sm text-gray-400">Loading…</span>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-lg">
                No accounts yet
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Add your IPTV provider credentials to get started.
              </p>
            </div>
            <Button
              onClick={() => setModal("add")}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg"
            >
              + Add account
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
            {accounts.map((a) => (
              <div
                key={a.id}
                onClick={() => navigate(`/account/${a.id}`)}
                className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-blue-500/50 rounded-xl p-5 cursor-pointer transition-all duration-150"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <svg
                      className="w-5 h-5 text-blue-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
                    </svg>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusTarget(a);
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-green-400 hover:bg-gray-700 transition-colors"
                      title="Account status"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal(a);
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
                      title="Edit"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id);
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                      title="Delete"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="font-semibold text-white text-base truncate">
                  {a.name}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {a.serverUrl}
                </p>
                <p className="text-xs text-gray-600 truncate">{a.username}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-white font-semibold text-base mb-5">
              {modal === "add"
                ? "Add account"
                : `Edit — ${(modal as Account).name}`}
            </h2>
            <AccountForm
              initial={modal === "add" ? undefined : (modal as Account)}
              onSave={handleSave}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {/* Status modal */}
      {statusTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeStatus}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-base">
                  Account Status
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {statusTarget.name}
                </p>
              </div>
              <button
                onClick={closeStatus}
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

            {statusLoading && (
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
                <span className="text-sm text-gray-400">Fetching status…</span>
              </div>
            )}

            {statusError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {statusError}
              </div>
            )}

            {statusData && !statusLoading && <StatusPanel data={statusData} />}
          </div>
        </div>
      )}
    </div>
  );
}
