'use client';

import * as React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Download,
  Video,
  Search,
  Maximize2,
  Menu,
  Film
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { fetchCameras, fetchRecordings, getApiUrl } from '@/lib/api';

interface Camera {
  id: string;
  name: string;
  v380Id: string;
  hasRecordings?: boolean;
}

interface RecordingInfo {
  filename: string;
  size: number;
  createdAt: string;
}

// Helper to extract start time in seconds from V380 filename (e.g., "96555529_20260713_140000.mkv")
const getStartTimeSecondsFromFilename = (filename: string): number | null => {
  const parts = filename.split('_');
  if (parts.length >= 3) {
    const timeStr = parts[2].split('.')[0]; // "140000"
    if (timeStr && timeStr.length === 6) {
      const h = parseInt(timeStr.substring(0, 2), 10);
      const m = parseInt(timeStr.substring(2, 4), 10);
      const s = parseInt(timeStr.substring(4, 6), 10);
      if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
        return h * 3600 + m * 60 + s;
      }
    }
  }
  return null;
};

export default function PlaybackPage() {
  const [date, setDate] = React.useState<Date>(new Date());
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [selectedCamera, setSelectedCamera] = React.useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = React.useState<number>(1);

  const [cameras, setCameras] = React.useState<Camera[]>([]);
  const [recordings, setRecordings] = React.useState<RecordingInfo[]>([]);
  const [selectedRecording, setSelectedRecording] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const pendingSeekRef = React.useRef<number | null>(null);

  // Timeline state (0 to 24 hours in seconds = 86400)
  const [timeProgress, setTimeProgress] = React.useState(14 * 3600); // Start at 14:00
  const [baseClipStartTime, setBaseClipStartTime] = React.useState<number>(0);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const loadCameras = React.useCallback(async () => {
    try {
      const data = await fetchCameras();
      setCameras(data);
      if (data.length > 0) {
        setSelectedCamera(data[0].v380Id);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load cameras on mount
  React.useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  // Fetch recordings when date or camera changes
  const handleSearch = React.useCallback(async () => {
    if (!selectedCamera) return;
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const files = await fetchRecordings(formattedDate);
      // Filter recordings that belong to the selected camera ID
      const cameraFiles = files.filter((f: RecordingInfo) => f.filename.includes(selectedCamera));
      setRecordings(cameraFiles);
      if (cameraFiles.length > 0) {
        setSelectedRecording(cameraFiles[0].filename);
      } else {
        setSelectedRecording(null);
      }
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setRecordings([]);
    }
  }, [date, selectedCamera]);

  React.useEffect(() => {
    if (selectedCamera) {
      handleSearch();
    }
  }, [selectedCamera, handleSearch]);

  // When selected recording changes, update base time
  React.useEffect(() => {
    if (selectedRecording) {
      const startTime = getStartTimeSecondsFromFilename(selectedRecording);
      if (startTime !== null) {
        setBaseClipStartTime(startTime);
        // Only reset slider if not a slider-initiated switch
        if (pendingSeekRef.current === null) {
          setTimeProgress(startTime);
        }
      }
    }
  }, [selectedRecording]);

  // Use this to sync the UI whenever video actually plays/pauses
  const syncPlayState = () => {
     if (videoRef.current) {
        setIsPlaying(!videoRef.current.paused);
     }
  };

  // Handle video play / pause commands using REAL DOM state
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => {
         console.error("Autoplay/Play blocked by browser:", err);
         setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
    }
  };

  const handleSpeedChange = () => {
    if (!videoRef.current) return;
    const speeds = [1, 2, 4, 0.5];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    videoRef.current.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen().catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentSeconds = Math.floor(videoRef.current.currentTime);
      setTimeProgress(baseClipStartTime + currentSeconds);
    }
  };

  const handleSliderSeek = (val: number | readonly number[]) => {
    const targetSeconds = Array.isArray(val) || typeof val !== 'number' ? (val as readonly number[])[0] : val;
    setTimeProgress(targetSeconds);

    // Find which clip contains the target time
    // ponytail: assumes ~900s per clip; upgrade to real duration from metadata if needed
    const matchingClip = recordings.find((rec) => {
      const start = getStartTimeSecondsFromFilename(rec.filename);
      if (start === null) return false;
      return targetSeconds >= start && targetSeconds < start + 900;
    });

    if (matchingClip && matchingClip.filename !== selectedRecording) {
      // Switch to the clip that contains the seek target
      setSelectedRecording(matchingClip.filename);
      // After clip loads, seek to correct offset
      const start = getStartTimeSecondsFromFilename(matchingClip.filename) ?? 0;
      pendingSeekRef.current = targetSeconds - start;
    } else if (videoRef.current && selectedRecording) {
      const offsetInClip = targetSeconds - baseClipStartTime;
      if (offsetInClip >= 0 && (!videoRef.current.duration || offsetInClip <= videoRef.current.duration)) {
        videoRef.current.currentTime = offsetInClip;
      }
    }
  };

  const SearchAndCameraList = (
    <>
      <div className="p-4 border-b shrink-0">
        <h2 className="font-semibold mb-4">Search Options</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Select Date
            </label>
            <Input
              type="date"
              className="w-full"
              value={format(date, 'yyyy-MM-dd')}
              onChange={(e) => setDate(new Date(e.target.value))}
            />
          </div>
          <Button className="w-full" onClick={handleSearch}>
            <Search className="mr-2 h-4 w-4" /> Search Recordings
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-6">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Available Cameras
            </label>
            <div className="space-y-1">
              {cameras.map((cam) => (
                <button
                  key={cam.v380Id}
                  onClick={() => setSelectedCamera(cam.v380Id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md p-2 text-sm transition-colors text-left",
                    selectedCamera === cam.v380Id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <Video className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{cam.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recordings List */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
              <span>Clips on {format(date, 'MMM d')}</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{recordings.length} files</span>
            </label>
            {recordings.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border rounded border-dashed">
                No recordings found for this date.
              </div>
            ) : (
              <div className="space-y-1">
                {recordings.map((rec) => {
                  const clipStart = getStartTimeSecondsFromFilename(rec.filename);
                  const clipTimeStr = clipStart !== null ? formatTime(clipStart) : rec.filename;
                  const isSelected = selectedRecording === rec.filename;
                  const sizeMb = (rec.size / (1024 * 1024)).toFixed(1);

                  return (
                    <button
                      key={rec.filename}
                      onClick={() => setSelectedRecording(rec.filename)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 rounded-md p-2 text-xs transition-colors text-left font-mono border",
                        isSelected
                          ? "bg-secondary border-primary text-secondary-foreground font-semibold shadow-sm"
                          : "hover:bg-muted border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Film className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{clipTimeStr}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{sizeMb} MB</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 min-h-0 p-2 lg:p-0">

      {/* Mobile Header Toolbar for Sheet Trigger */}
      <div className="lg:hidden flex items-center justify-between bg-card border rounded-xl p-2 px-3 shrink-0 shadow-sm">
        <div className="flex flex-col">
          <span className="text-sm font-semibold truncate max-w-[200px]">
            {cameras.find(c => c.v380Id === selectedCamera)?.name || 'Select Camera'}
          </span>
          <span className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy')}</span>
        </div>

        <Sheet>
          <SheetTrigger render={
            <Button variant="secondary" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">Options</span>
            </Button>
          } />
          <SheetContent side="bottom" className="h-[80vh] sm:h-auto sm:max-h-[85vh] p-0 flex flex-col">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Playback Options</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {SearchAndCameraList}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Left Panel: Selection */}
      <Card className="hidden w-72 flex-col lg:flex shrink-0 overflow-hidden shadow">
        {SearchAndCameraList}
      </Card>

      {/* Right Panel: Player & Timeline */}
      <div className="flex flex-1 flex-col gap-4 min-h-0">
        {/* Main Video Area */}
        <div className="flex-1 bg-black rounded-lg relative flex items-center justify-center overflow-hidden min-h-0 shadow">
          {/* Top overlay info - Hidden on mobile because it's in the mobile toolbar above */}
          <div className="hidden lg:flex absolute top-4 left-4 bg-black/60 text-white px-3 py-1.5 rounded-md text-sm font-medium backdrop-blur-sm z-10 flex-col pointer-events-none">
            <span>{cameras.find(c => c.v380Id === selectedCamera)?.name || 'Select Camera'}</span>
            <span className="text-xs text-zinc-300">{format(date, 'yyyy-MM-dd')} {formatTime(timeProgress)}</span>
          </div>

          {/* Mobile floating time */}
          <div className="lg:hidden absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-sm z-10 pointer-events-none font-mono">
            {formatTime(timeProgress)}
          </div>

          {selectedRecording ? (
            <video
              ref={videoRef}
              src={selectedRecording ? `${getApiUrl()}/recordings/stream/${selectedRecording}` : undefined}
              autoPlay={true}
              onPlay={syncPlayState}
              onPause={syncPlayState}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                   if (pendingSeekRef.current !== null) {
                     videoRef.current.currentTime = pendingSeekRef.current;
                     pendingSeekRef.current = null;
                   }
                   videoRef.current.play().catch(() => setIsPlaying(false));
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                // Auto-advance to next clip
                const idx = recordings.findIndex(r => r.filename === selectedRecording);
                if (idx >= 0 && idx < recordings.length - 1) {
                  setSelectedRecording(recordings[idx + 1].filename);
                } else {
                  setIsPlaying(false);
                }
              }}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-zinc-600 flex flex-col items-center">
              <Play className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm px-4 text-center">No recording file selected for this date/camera</p>
            </div>
          )}
        </div>

        {/* Controls & Timeline */}
        <Card className="p-4 shrink-0 flex flex-col gap-4 shadow">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }}
                title="Rewind 10s"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-4 w-4 sm:h-5 sm:w-5" /> : <Play className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime += 10;
                }}
                title="Forward 10s"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <div className="hidden sm:block w-px h-6 bg-border mx-1" />
              <Button
                variant="outline"
                size="icon"
                title="Change Playback Speed"
                className="shrink-0"
                onClick={handleSpeedChange}
              >
                <FastForward className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-12 shrink-0 px-0 font-mono text-xs"
                onClick={handleSpeedChange}
              >
                {playbackSpeed}x
              </Button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Download Clip"
                className="shrink-0"
                onClick={() => {
                  if (selectedRecording) {
                    window.open(`${getApiUrl()}/recordings/stream/${selectedRecording}`, '_blank');
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-border mx-1" />
              <Button variant="outline" size="icon" title="Fullscreen" className="shrink-0" onClick={handleFullscreen}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2 mt-1">
            <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground font-medium px-1">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>

            <div className="relative h-10 sm:h-12 bg-muted rounded-md overflow-hidden cursor-pointer touch-none">
              {/* Grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({length: 24}).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-background/20 h-full" />
                ))}
              </div>

              {/* Dynamic Recording chunks blocks based on available clips */}
              <div className="absolute inset-0 top-1/2 -translate-y-1/2 h-4 pointer-events-none">
                {recordings.map((rec) => {
                  const clipStart = getStartTimeSecondsFromFilename(rec.filename);
                  if (clipStart === null) return null;
                  const leftPercent = (clipStart / 86400) * 100;
                  // Render a visual chunk of ~15 minutes (or actual duration if parsed/known)
                  const widthPercent = Math.max((900 / 86400) * 100, 1.5);

                  return (
                    <div
                      key={rec.filename}
                      className={cn(
                        "absolute h-full rounded-sm transition-colors",
                        selectedRecording === rec.filename ? "bg-primary ring-2 ring-primary z-10" : "bg-blue-500/70"
                      )}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`
                      }}
                    />
                  );
                })}
              </div>

              {/* Playhead Slider */}
              <Slider
                value={[timeProgress]}
                max={86400}
                step={1}
                className="absolute inset-0 h-full [&_[role=slider]]:h-full [&_[role=slider]]:w-0.5 sm:[&_[role=slider]]:w-1 [&_[role=slider]]:rounded-none [&_[role=slider]]:bg-red-500 [&_[role=slider]]:border-none"
                onValueChange={handleSliderSeek}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}