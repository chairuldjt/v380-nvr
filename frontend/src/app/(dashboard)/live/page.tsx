'use client';

import * as React from 'react';
import {
  Grid2X2,
  Grid3X3,
  Square,
  Maximize2,
  Video,
  Settings,
  MoreHorizontal,
  Lock,
  Unlock,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LivePlayer from '@/components/camera/LivePlayer';
import { fetchCameras, getLiveLayout, saveLiveLayout, sendPtzCommand } from '@/lib/api';

interface Camera {
  id: string;
  name: string;
  v380Id: string;
  ip: string;
  httpPort: number;
  status: string;
}

type GridSize = 1 | 2 | 4 | 9 | 16;

export default function LiveViewPage() {
  const [cameras, setCameras] = React.useState<Camera[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [gridSize, setGridSize] = React.useState<GridSize>(4);
  const [selectedCell, setSelectedCell] = React.useState<number | null>(0);
  const [isPanelOpen, setIsPanelOpen] = React.useState(true);
  const [isLocked, setIsLocked] = React.useState(true); // Default to locked to prevent accidental drags
  const [cellMap, setCellMap] = React.useState<Record<number, string>>({});

  
  
  React.useEffect(() => {
    const fetchStatus = () => {
      // Jalankan tanpa mematikan satu sama lain
      Promise.allSettled([fetchCameras(), getLiveLayout()])
      .then((results) => {
        // Ambil hasil kamera
        const camResult = results[0];
        let camData = [];
        if (camResult.status === 'fulfilled') {
          camData = camResult.value;
          setCameras(camData);
        } else {
          console.error('Failed to fetch cameras:', camResult.reason);
        }

        // Ambil hasil layout
        const layoutResult = results[1];
        if (layoutResult.status === 'fulfilled' && layoutResult.value) {
          const layoutData = layoutResult.value;
          setGridSize((layoutData.gridSize) || 4);
          if (layoutData.cellMap && Object.keys(layoutData.cellMap).length > 0) {
            setCellMap(layoutData.cellMap);
          } else {
            // Default: assign cameras to grid sequentially if no map saved
            const defaultMap: Record<number, string> = {};
            camData.forEach((cam: Camera, i: number) => {
              defaultMap[i] = cam.id;
            });
            setCellMap(defaultMap);
          }
        } else {
          console.warn('Failed to fetch layout (maybe backend not ready), using default layout', layoutResult.status === 'rejected' ? layoutResult.reason : '');
          // Default assignment if layout fails
          const defaultMap: Record<number, string> = {};
          camData.forEach((cam: Camera, i: number) => {
            defaultMap[i] = cam.id;
          });
          setCellMap(defaultMap);
        }
        
        
        setIsLoading(false);
      });
    };
    
    fetchStatus();
    
    // Polling status kamera setiap 5 detik agar dot merah/hijau sinkron dengan state asli backend
    const intervalId = setInterval(() => {
      fetchCameras().then(data => {
        setCameras(data);
      }).catch(console.error);
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, []);



  // Mapping cell index to camera ID
  
  
  const handleCameraClick = (cameraId: string) => {
    if (isLocked) return;
    if (selectedCell !== null) {
      setCellMap(prev => {
        const nextMap = { ...prev, [selectedCell]: cameraId };
        saveLiveLayout(gridSize, nextMap).catch(console.error);
        return nextMap;
      });
    }
  };

  const handleCameraDragStart = (e: React.DragEvent, cameraId: string) => {
    e.dataTransfer.setData('cameraId', cameraId);
  };

  
  const handleGridChange = (newSize: GridSize) => {
    setGridSize(newSize);
    saveLiveLayout(newSize, cellMap).catch(console.error);
  };

  const handleCellDrop = (e: React.DragEvent, cellIndex: number) => {
    if (isLocked) return;
    e.preventDefault();
    const cameraId = e.dataTransfer.getData('cameraId');
    if (cameraId) {
      setCellMap(prev => {
        const nextMap = { ...prev, [cellIndex]: cameraId };
        saveLiveLayout(gridSize, nextMap).catch(console.error);
        return nextMap;
      });
    }
  };


  
  const handlePtz = async (cmd: string) => {
    if (selectedCell === null) return;
    const camId = cellMap[selectedCell];
    if (!camId) return;
    const cam = cameras.find(c => c.id === camId);
    if (!cam) return;
    
    try {
      await sendPtzCommand(cam.v380Id, cmd);
    } catch (e) {
      console.error('PTZ error', e);
    }
  };

  
  const handleFullscreen = () => {
    const el = document.querySelector('#live-grid-container');
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen().catch((err) => {
        console.error('Fullscreen error:', err);
      });
    }
  };

  const handleCellDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row h-full gap-4 min-h-0 overflow-y-auto lg:overflow-hidden p-2 lg:p-0">
      {/* Left panel: Cameras Tree & PTZ */}
      {/* Left panel: Cameras Tree & PTZ */}
      <div 
        className={cn(
          "w-full lg:w-72 shrink-0 overflow-hidden transition-all duration-300 ease-in-out border rounded-xl bg-card text-card-foreground shadow",
          isPanelOpen ? "h-[320px] lg:h-full opacity-100" : "h-12 lg:h-full opacity-100"
        )}
      >
        <div className="flex items-center justify-between p-2 lg:hidden border-b bg-muted/50">
           <span className="text-sm font-semibold ml-2">Controls</span>
           <Button variant="ghost" size="sm" onClick={() => setIsPanelOpen(!isPanelOpen)}>
             {isPanelOpen ? 'Collapse ▼' : 'Expand ▲'}
           </Button>
        </div>
        <div className={cn(
          "h-full flex flex-col transition-opacity duration-300", 
          !isPanelOpen && "hidden lg:flex"
        )}>
          <Tabs defaultValue="cameras" className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b px-4 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="cameras" className="flex-1">Cameras</TabsTrigger>
              <TabsTrigger value="ptz" className="flex-1">PTZ</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="cameras" className="flex-1 overflow-hidden p-0 m-0">
            <ScrollArea className="h-full">
              <div className="p-4 flex flex-col gap-2">
                <div className="text-sm font-semibold mb-2">Device List <span className="text-xs text-muted-foreground font-normal ml-1 hidden lg:inline">(Drag to assign)</span><span className="text-xs text-muted-foreground font-normal ml-1 lg:hidden">(Tap to assign to active CH)</span></div>
                {isLoading ? (
                  <div className="text-sm text-muted-foreground p-2">Loading cameras...</div>
                ) : cameras.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">No cameras found.</div>
                ) : (
                  cameras.map((cam) => (
                    <div
                      key={cam.id}
                      draggable
                      onDragStart={(e) => handleCameraDragStart(e, cam.id)}
                      onClick={() => handleCameraClick(cam.id)}
                      className="flex items-center gap-2 rounded-md p-2 hover:bg-muted cursor-grab active:cursor-grabbing border bg-background"
                    >
                      <Video className={cn("h-4 w-4", cam.status === 'online' ? "text-green-500" : "text-muted-foreground")} />
                      <span className="text-sm flex-1 truncate">{cam.name}</span>
                      {cam.status === 'online' ? (
                        <span className="flex h-2 w-2 rounded-full bg-green-500" />
                      ) : (
                        <span className="flex h-2 w-2 rounded-full bg-destructive" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ptz" className="flex-1 p-4 m-0">
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="icon" className="rotate-[-45deg]" onPointerDown={() => handlePtz("UP_LEFT")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
                <Button variant="outline" size="icon" onPointerDown={() => handlePtz("up")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
                <Button variant="outline" size="icon" className="rotate-[45deg]" onPointerDown={() => handlePtz("UP_RIGHT")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
                <Button variant="outline" size="icon" onPointerDown={() => handlePtz("left")} onPointerUp={() => handlePtz("STOP")}>◀</Button>
                <Button variant="outline" size="icon" className="bg-primary/10" onPointerDown={() => handlePtz("STOP")}>◎</Button>
                <Button variant="outline" size="icon" onPointerDown={() => handlePtz("right")} onPointerUp={() => handlePtz("STOP")}>▶</Button>
                <Button variant="outline" size="icon" className="rotate-[-135deg]" onPointerDown={() => handlePtz("DOWN_LEFT")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
                <Button variant="outline" size="icon" className="rotate-180" onPointerDown={() => handlePtz("down")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
                <Button variant="outline" size="icon" className="rotate-[135deg]" onPointerDown={() => handlePtz("DOWN_RIGHT")} onPointerUp={() => handlePtz("STOP")}>▲</Button>
              </div>
              {selectedCell !== null && cellMap[selectedCell] ? (
                <div className="text-xs text-center text-foreground font-semibold mt-4 bg-muted px-3 py-1.5 rounded border border-border">
                  PTZ Target: CH {selectedCell + 1} ({cameras.find(c => c.id === cellMap[selectedCell!])?.name || 'Camera'})
                </div>
              ) : (
                <div className="text-sm text-center text-muted-foreground mt-4">
                  Klik/pilih salah satu kotak kamera dulu (Pastikan status Unlocked jika ingin mengganti kamera pada Grid)
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Right panel: Video Grid */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Toolbar */}
        <Card className="flex flex-row items-center px-2 py-1 gap-1.5 h-11 shrink-0 overflow-x-auto">
          <div className="flex bg-muted rounded-md p-1">
            <Button
              variant={gridSize === 1 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGridChange(1)}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={gridSize === 2 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGridChange(2)}
              title="2 Cameras (Split)"
            >
              <div className="flex flex-col gap-0.5 w-4 h-4">
                <div className="bg-current rounded-[1px] flex-1" />
                <div className="bg-current rounded-[1px] flex-1" />
              </div>
            </Button>
            <Button
              variant={gridSize === 4 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGridChange(4)}
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant={gridSize === 9 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGridChange(9)}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={gridSize === 16 ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => handleGridChange(16)}
            >
              <div className="grid grid-cols-4 gap-0.5 w-4 h-4">
                {Array.from({length: 16}).map((_, i) => (
                  <div key={i} className="bg-current rounded-[1px]" />
                ))}
              </div>
            </Button>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setIsLocked(!isLocked)}
            title={isLocked ? "Locked" : "Unlocked"}
          >
            {isLocked ? <Lock className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-green-500" />}
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleFullscreen} title="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            
          </div>
        </Card>

        {/* Grid Container */}
        <div
          id="live-grid-container"
          className="flex-1 bg-black rounded-lg overflow-hidden grid gap-0.5 p-0.5"
          style={{
            gridTemplateColumns: gridSize === 2 ? 'repeat(1, minmax(0, 1fr))' : `repeat(${Math.sqrt(gridSize)}, minmax(0, 1fr))`,
            gridTemplateRows: gridSize === 2 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${Math.sqrt(gridSize)}, minmax(0, 1fr))`
          }}
        >
          {Array.from({ length: gridSize }).map((_, i) => {
            const cameraId = cellMap[i];
            const camera = cameraId ? cameras.find(c => c.id === cameraId) : null;
            const isSelected = selectedCell === i;

            return (
              <div
                key={i}
                className={cn(
                  "relative bg-zinc-900 group flex items-center justify-center transition-colors w-full h-full",
                  isSelected ? "border-4 border-white dark:border-zinc-200 ring-4 ring-white/30 dark:ring-white/20 z-30 shadow-lg" : "border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
                onClick={() => setSelectedCell(i)}
                onDrop={(e) => handleCellDrop(e, i)}
                onDragOver={handleCellDragOver}
              >
                {/* Remove / Change Camera Button Overlay */}
                {!isLocked && camera && (
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="absolute top-2 left-2 h-6 w-6 z-40 opacity-70 hover:opacity-100 rounded-full"
                    title="Remove Camera from this grid"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCellMap(prev => {
                        const newMap = { ...prev };
                        delete newMap[i];
                        saveLiveLayout(gridSize, newMap).catch(console.error);
                        return newMap;
                      });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {camera ? (
                  <LivePlayer camera={camera} />
                ) : (
                  <div className="text-zinc-700 text-xs font-mono">
                    CH {i + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
