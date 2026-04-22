import { useUpdater } from "../hooks/useUpdater";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function UpdateNotification() {
  const {
    updateAvailable,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    downloadAndInstall,
  } = useUpdater();

  if (isChecking) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-900">Checking for updates...</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-900">Update check failed: {error}</p>
        </Card>
      </div>
    );
  }

  if (!updateAvailable) {
    return null;
  }

  if (isDownloading) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="p-4 bg-green-50 border-green-200 min-w-75">
          <p className="text-sm text-green-900 mb-2">Downloading update...</p>
          <div className="w-full bg-green-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-xs text-green-700 mt-1">
            {Math.round(downloadProgress)}%
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-yellow-900">
              Update Available
            </p>
            <p className="text-xs text-yellow-700">
              A new version is ready to install
            </p>
          </div>
          <Button
            onClick={downloadAndInstall}
            size="sm"
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Install
          </Button>
        </div>
      </Card>
    </div>
  );
}
