'use client';

import * as React from 'react';
import { Video, RefreshCw, Camera as CameraIcon, AlertCircle, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { startCameraDecoder } from '@/lib/api';

interface CameraData {
  id: string;
  name: string;
  v380Id?: string;
  ip: string;
  httpPort: number;
  status: string;
}

interface LivePlayerProps {
  camera: CameraData;
  backendHost?: string;
}

export default function LivePlayer({ camera, backendHost = 'localhost' }: LivePlayerProps) {
  const [streamError, setStreamError] = React.useState(false);
  const [streamKey, setStreamKey] = React.useState(0); // Digunakan untuk me-refresh <img> stream
  const [isStarting, setIsStarting] = React.useState(false);

  // Resolve the actual host, if not provided we prefer window.location.hostname to support network access
  const resolvedHost = React.useMemo(() => {
    if (backendHost !== 'localhost') return backendHost;
    if (typeof window !== 'undefined' && window.location.hostname) {
      return window.location.hostname;
    }
    return 'localhost';
  }, [backendHost]);

  // Arahkan ke /api/stream/:port/ di backend proxy karena Next.js rewrites sering bermasalah dengan :port
  const { getApiUrl } = require('@/lib/api');
  const apiUrl = getApiUrl();
  // apiUrl biasanya "/api", kita potong "api" dan arahkan ke "/stream" milik backend proxy port 4000
  const baseUrl = apiUrl.endsWith('/api') ? apiUrl.replace('/api', '') : apiUrl;

  const streamUrl = `${baseUrl}/stream/${camera.httpPort}/mjpeg?t=${streamKey}`;
  const snapshotUrl = `${baseUrl}/stream/${camera.httpPort}/snapshot`;

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStreamError(false);
    setStreamKey((prev) => prev + 1);
  };

  const handleSnapshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(snapshotUrl, '_blank');
  };

  const handleStartStream = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!camera.v380Id) return;
    setIsStarting(true);
    try {
      await startCameraDecoder(camera.v380Id);
      setTimeout(() => {
        setIsStarting(false);
        setStreamError(false);
        // Paksa refresh gambar dengan merubah streamKey
        setStreamKey((prev) => prev + 1);
      }, 3500); // Wait longer (3.5 seconds) to ensure the stream is truly ready
    } catch (err) {
      console.error("Start stream failed", err);
      setIsStarting(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden group">
      {/* Top Status Bar Overlay */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded flex items-center gap-2">
          <span className="font-semibold truncate max-w-[120px]">{camera.name}</span>
          <span className="text-zinc-400 font-mono text-[10px]">:{camera.httpPort}</span>
        </div>

        <Badge
          variant="outline"
          className={
            !streamError
              ? 'bg-green-500/20 text-green-400 border-green-500/30 text-[10px]'
              : 'bg-red-500/20 text-red-400 border-red-500/30 text-[10px]'
          }
        >
          {!streamError ? 'LIVE (MJPEG)' : 'OFFLINE'}
        </Badge>
      </div>

      {/* Main Video Area (MJPEG using Native <img> element) */}
      {!streamError ? (
        <img
          key={streamKey}
          src={streamUrl}
          alt={`Stream ${camera.name}`}
          onError={() => setStreamError(true)}
          className="w-full h-full object-contain bg-black"
        />
      ) : (
        /* Fallback / Error State */
        <div className="flex flex-col items-center justify-center text-zinc-500 gap-2 p-4 text-center">
          <AlertCircle className="h-8 w-8 text-yellow-500/70" />
          <span className="text-xs font-medium text-zinc-400">Stream tidak terhubung atau offline</span>
          <span className="text-[10px] text-zinc-600">Pastikan kamera menyala &amp; V380Decoder aktif</span>

          <div className="flex gap-2 mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-white border-none"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
            {camera.v380Id && (
              <Button
                variant="default"
                size="sm"
                disabled={isStarting}
                onClick={handleStartStream}
                className="h-7 text-xs"
              >
                <Play className="mr-1.5 h-3 w-3" /> {isStarting ? 'Starting...' : 'Start Decoder'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Floating Toolbar on Hover */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleSnapshot}
          title="Ambil Snapshot"
          className="h-7 w-7 rounded bg-black/60 text-white hover:bg-black/80 border-none"
        >
          <CameraIcon className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleRefresh}
          title="Reload Stream"
          className="h-7 w-7 rounded bg-black/60 text-white hover:bg-black/80 border-none"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
