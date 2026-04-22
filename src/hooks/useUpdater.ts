import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      setIsChecking(true);
      setError(null);
      const update = await check();

      if (update?.available) {
        setUpdateAvailable(true);
        console.log(
          `Update available: ${update.version}, current version: ${update.currentVersion}`,
        );
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsChecking(false);
    }
  }

  async function downloadAndInstall() {
    try {
      setIsDownloading(true);
      setError(null);
      const update = await check();

      if (!update?.available) {
        setUpdateAvailable(false);
        return;
      }

      console.log(`Downloading update ${update.version}...`);

      let totalBytes = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            console.log(`Started downloading ${totalBytes} bytes`);
            break;
          case "Progress":
            if (totalBytes > 0) {
              const progress = (event.data.chunkLength / totalBytes) * 100;
              setDownloadProgress(progress);
              console.log(
                `Downloaded ${event.data.chunkLength} of ${totalBytes}`,
              );
            }
            break;
          case "Finished":
            console.log("Download finished");
            break;
        }
      });

      console.log("Update installed, restarting...");
      await relaunch();
    } catch (err) {
      console.error("Failed to download and install update:", err);
      setError(err instanceof Error ? err.message : "Failed to update");
      setIsDownloading(false);
    }
  }

  return {
    updateAvailable,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    checkForUpdates,
    downloadAndInstall,
  };
}
