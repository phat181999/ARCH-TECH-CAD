import { useState } from "react";

const CLOUD_PROVIDERS = [
  {
    id: "google-drive",
    name: "Google Drive",
    icon: "☁️",
    color: "#4285F4",
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
    redirectUri: `${window.location.origin}/auth/google/callback`,
    authUrl: (clientId, redirectUri) =>
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/drive.file%20https://www.googleapis.com/auth/drive.metadata.readonly&access_type=offline`,
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "📦",
    color: "#0061FF",
    appKey: import.meta.env.VITE_DROPBOX_APP_KEY || "",
    redirectUri: `${window.location.origin}/auth/dropbox/callback`,
    authUrl: (appKey, redirectUri) =>
      `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&redirect_uri=${redirectUri}&response_type=token&token_access_type=offline`,
  },
];

export default function CloudStorage({ onImportDrawing, onExportDrawing }) {
  const [connected, setConnected] = useState({});
  const [showPanel, setShowPanel] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleConnect = (provider) => {
    if (provider.id === "google-drive" && provider.clientId) {
      window.open(provider.authUrl(provider.clientId, provider.redirectUri), "_blank", "width=600,height=700");
      // In a real app, handle the OAuth callback
      setConnected({ ...connected, [provider.id]: true });
    } else if (provider.id === "dropbox" && provider.appKey) {
      window.open(provider.authUrl(provider.appKey, provider.redirectUri), "_blank", "width=600,height=700");
      setConnected({ ...connected, [provider.id]: true });
    } else {
      // Demo mode - simulate connection
      setConnected({ ...connected, [provider.id]: true });
      // Add sample files
      setFiles([
        { id: "1", name: "FloorPlan_v2.dxf", provider: provider.id, size: "245 KB" },
        { id: "2", name: "Elevation_South.dxf", provider: provider.id, size: "189 KB" },
        { id: "3", name: "Section_A-A.dxf", provider: provider.id, size: "312 KB" },
      ]);
    }
  };

  const handleDisconnect = (providerId) => {
    const { [providerId]: _, ...rest } = connected;
    setConnected(rest);
    setFiles(files.filter((f) => f.provider !== providerId));
  };

  const handleImport = (file) => {
    if (onImportDrawing) {
      onImportDrawing(file);
    }
  };

  const handleExportToCloud = () => {
    if (onExportDrawing) {
      onExportDrawing();
    }
  };

  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="w-full px-3 py-1.5 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 text-xs font-medium"
      >
        ☁️ Cloud Storage
      </button>
    );
  }

  return (
    <div className="border-b border-gray-700">
      <div className="p-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">☁️ Cloud Storage</h3>
        <button
          onClick={() => setShowPanel(false)}
          className="text-gray-400 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {CLOUD_PROVIDERS.map((provider) => (
          <div key={provider.id} className="bg-gray-700/50 rounded p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span>{provider.icon}</span>
                <span className="text-sm text-gray-200">{provider.name}</span>
              </div>
              {connected[provider.id] ? (
                <button
                  onClick={() => handleDisconnect(provider.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(provider)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Connect
                </button>
              )}
            </div>
            {connected[provider.id] && (
              <div className="text-xs text-gray-500">
                Connected ✓
              </div>
            )}
          </div>
        ))}

        {/* Files from cloud */}
        {files.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-400 mb-1">Cloud Files:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between bg-gray-700/30 rounded px-2 py-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-300 truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">{file.size}</div>
                  </div>
                  <button
                    onClick={() => handleImport(file)}
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2 flex-shrink-0"
                  >
                    Import
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export button */}
        <button
          onClick={handleExportToCloud}
          className="w-full px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs hover:bg-gray-500 mt-1"
        >
          Export Current Drawing to Cloud
        </button>
      </div>
    </div>
  );
}