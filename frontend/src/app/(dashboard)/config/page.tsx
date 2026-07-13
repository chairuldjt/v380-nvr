'use client';

import * as React from 'react';
import { Plus, Trash2, Edit2, RefreshCw, CheckCircle, XCircle, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { fetchCameras, createCamera, updateCamera, deleteCamera, startCameraDecoder, stopCameraDecoder, toggleCameraRecording } from '@/lib/api';

interface Camera {
  id: string;
  name: string;
  v380Id: string;
  ip: string;
  username?: string;
  password?: string;
  httpPort: number;
  rtspPort: number;
  hasOnvif: boolean;
  status: string;
  isRecording?: boolean;
}

export default function ConfigPage() {
  const [cameras, setCameras] = React.useState<Camera[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editingCameraId, setEditingCameraId] = React.useState<string | null>(null);

  // New camera form state
  const defaultFormData = {
    name: 'New Camera',
    v380Id: '',
    ip: '10.10.10.24',
    username: '',
    password: '',
    httpPort: 8082,
    rtspPort: 8556,
    hasOnvif: true,
  };
  const [formData, setFormData] = React.useState(defaultFormData);

  const loadCameras = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCameras();
      setCameras(data);
    } catch (err) {
      console.error('Error fetching cameras:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCameras();
  }, [loadCameras]);

  const openAddDialog = () => {
    setFormData(defaultFormData);
    setEditingCameraId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (cam: Camera) => {
    setFormData({
      name: cam.name,
      v380Id: cam.v380Id,
      ip: cam.ip,
      username: cam.username || '',
      password: cam.password || '',
      httpPort: cam.httpPort,
      rtspPort: cam.rtspPort,
      hasOnvif: cam.hasOnvif,
    });
    setEditingCameraId(cam.v380Id);
    setIsEditDialogOpen(true);
  };

  const handleSaveCamera = async () => {
    if (!formData.v380Id || !formData.ip) return;
    try {
      if (editingCameraId) {
        await updateCamera(editingCameraId, formData);
        setIsEditDialogOpen(false);
      } else {
        await createCamera(formData);
        setIsDialogOpen(false);
      }
      loadCameras();
    } catch (err) {
      console.error('Failed to save camera:', err);
    }
  };

  const handleDeleteCamera = async (v380Id: string) => {
    try {
      await deleteCamera(v380Id);
      loadCameras();
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  const handleToggleStream = async (v380Id: string, currentStatus: string) => {
    try {
      if (currentStatus === 'online' || currentStatus === 'starting') {
        await stopCameraDecoder(v380Id);
      } else {
        await startCameraDecoder(v380Id);
      }
      // Reload shortly after to let wrapper update DB status
      setTimeout(() => loadCameras(), 1500);
    } catch (err) {
      console.error('Failed to toggle stream:', err);
    }
  };

  const handleToggleRecording = async (v380Id: string, currentIsRecording: boolean) => {
    try {
      // Optimistic update for snappy UI feel
      setCameras(prev => prev.map(c => c.v380Id === v380Id ? { ...c, isRecording: !currentIsRecording } : c));
      await toggleCameraRecording(v380Id, !currentIsRecording);
    } catch (err) {
      console.error('Failed to toggle recording:', err);
      // Revert if failed
      loadCameras();
    }
  };

  const cameraFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="id" className="text-right">V380 ID</Label>
        <Input
          id="id"
          placeholder="8084xxxx"
          value={formData.v380Id}
          onChange={(e) => setFormData({ ...formData, v380Id: e.target.value })}
          className="col-span-3"
          disabled={!!editingCameraId}
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="ip" className="text-right">IP Address</Label>
        <Input
          id="ip"
          value={formData.ip}
          onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="username" className="text-right">Username</Label>
        <Input
          id="username"
          placeholder="admin or V380 ID"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="password" className="text-right">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder={editingCameraId ? 'Leave blank to keep unchanged' : ''}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="http" className="text-right">HTTP Port</Label>
        <Input
          id="http"
          type="number"
          value={formData.httpPort}
          onChange={(e) => setFormData({ ...formData, httpPort: Number(e.target.value) })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="rtsp" className="text-right">RTSP Port</Label>
        <Input
          id="rtsp"
          type="number"
          value={formData.rtspPort}
          onChange={(e) => setFormData({ ...formData, rtspPort: Number(e.target.value) })}
          className="col-span-3"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="onvif" className="text-right">ONVIF</Label>
        <div className="col-span-3 flex items-center space-x-2">
          <Switch
            id="onvif"
            checked={formData.hasOnvif}
            onCheckedChange={(checked) => setFormData({ ...formData, hasOnvif: checked })}
          />
          <Label htmlFor="onvif" className="text-xs text-muted-foreground">Enable ONVIF support</Label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-6 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Camera Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Manage your V380 cameras, ports, and RTSP streams.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={<Button onClick={openAddDialog} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Camera</Button>} />
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add V380 Camera</DialogTitle>
              <DialogDescription>
                Enter the camera details to add it to the NVR decoding pool.
              </DialogDescription>
            </DialogHeader>
            {cameraFormFields}
            <DialogFooter>
              <Button type="button" onClick={handleSaveCamera}>Save Camera</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden min-h-0 shadow">
        <CardHeader className="shrink-0">
          <CardTitle>Registered Cameras</CardTitle>
          <CardDescription>
            List of active cameras currently managed by the V380Decoder service.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Recording</TableHead>
                    <TableHead>Camera Name</TableHead>
                    <TableHead>V380 ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>RTSP Port</TableHead>
                    <TableHead>HTTP Port</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        Loading cameras from database...
                      </TableCell>
                    </TableRow>
                  ) : cameras.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        No cameras registered yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cameras.map((cam) => (
                      <TableRow key={cam.id}>
                        <TableCell>
                          {cam.status === 'online' ? (
                            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                              <CheckCircle className="mr-1 h-3 w-3" /> Online
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" /> Offline
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 px-2 gap-1.5", cam.isRecording ? "text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20" : "text-muted-foreground")}
                            onClick={() => handleToggleRecording(cam.v380Id, !!cam.isRecording)}
                          >
                            <div className={cn("h-2 w-2 rounded-full", cam.isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground")} />
                            {cam.isRecording ? 'REC' : 'OFF'}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{cam.name}</TableCell>
                        <TableCell className="font-mono text-xs">{cam.v380Id}</TableCell>
                        <TableCell className="font-mono text-xs">{cam.ip}</TableCell>
                        <TableCell>{cam.rtspPort}</TableCell>
                        <TableCell>{cam.httpPort}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={cam.status === 'online' || cam.status === 'starting' ? "secondary" : "default"}
                              size="icon"
                              title={cam.status === 'online' || cam.status === 'starting' ? "Stop Decoder" : "Start Decoder"}
                              onClick={() => handleToggleStream(cam.v380Id, cam.status)}
                            >
                              <RefreshCw className={cn("h-4 w-4", cam.status === 'starting' && "animate-spin")} />
                            </Button>
                            <Button variant="ghost" size="icon" title="Edit Camera" onClick={() => openEditDialog(cam)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              } />
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the camera
                                    configuration from the NVR and stop any running decoder streams.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCamera(cam.v380Id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete Camera
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards Grid */}
            <div className="md:hidden p-4 space-y-3">
              {loading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Loading cameras from database...
                </div>
              ) : cameras.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No cameras registered yet.
                </div>
              ) : (
                cameras.map((cam) => (
                  <Card key={cam.id} className="p-3 space-y-3 bg-muted/40 border">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium truncate flex items-center gap-2">
                        {cam.name}
                        {cam.isRecording && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Recording" />}
                      </div>
                      <div>
                        {cam.status === 'online' ? (
                          <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" /> Online
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="mr-1 h-3 w-3" /> Offline
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground font-mono bg-background p-2 rounded border">
                      <div>ID: <span className="text-foreground">{cam.v380Id}</span></div>
                      <div>IP: <span className="text-foreground">{cam.ip}</span></div>
                      <div>RTSP: <span className="text-foreground">{cam.rtspPort}</span></div>
                      <div>HTTP: <span className="text-foreground">{cam.httpPort}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="text-xs">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("h-8 px-2 gap-1.5", cam.isRecording ? "text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20" : "text-muted-foreground")}
                          onClick={() => handleToggleRecording(cam.v380Id, !!cam.isRecording)}
                        >
                          <div className={cn("h-2 w-2 rounded-full", cam.isRecording ? "bg-red-500 animate-pulse" : "bg-muted-foreground")} />
                          {cam.isRecording ? 'REC' : 'Record'}
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant={cam.status === 'online' || cam.status === 'starting' ? "secondary" : "default"}
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => handleToggleStream(cam.v380Id, cam.status)}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", cam.status === 'starting' && "animate-spin")} />
                          {cam.status === 'online' ? 'Stop' : 'Start'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Edit Camera" onClick={() => openEditDialog(cam)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger render={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          } />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the camera
                                configuration from the NVR and stop any running decoder streams.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCamera(cam.v380Id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete Camera
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit V380 Camera</DialogTitle>
              <DialogDescription>
                Modify the camera configuration. Changes will take effect on next stream start.
              </DialogDescription>
            </DialogHeader>
            {cameraFormFields}
            <DialogFooter>
              <Button type="button" onClick={handleSaveCamera}>Update Camera</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}