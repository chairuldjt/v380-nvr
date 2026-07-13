'use client';

import * as React from 'react';
import { HardDrive, Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getSystemConfig, updateSystemConfig } from '@/lib/api';

export default function StorageSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [retentionDays, setRetentionDays] = React.useState<number>(7);
  const [maxStorageGB, setMaxStorageGB] = React.useState<number>(500);
  const [autoDelete, setAutoDelete] = React.useState<boolean>(true);

  const loadConfigs = React.useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const data = await getSystemConfig();
      if (data.retentionDays !== undefined) setRetentionDays(Number(data.retentionDays));
      if (data.maxStorageGB !== undefined) setMaxStorageGB(Number(data.maxStorageGB));
      if (data.autoDelete !== undefined) setAutoDelete(data.autoDelete === true || data.autoDelete === 'true');
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to load storage configurations from server.' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateSystemConfig({
        retentionDays,
        maxStorageGB,
        autoDelete
      });
      setStatusMsg({ type: 'success', text: 'Storage settings have been updated successfully.' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to update storage settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 min-h-0 max-w-4xl mx-auto w-full p-2 sm:p-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage & Playback Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure how V380 recording files are stored, retained, and automatically purged.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConfigs} disabled={loading || saving}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </Button>
      </div>

      {statusMsg && (
        <Alert variant={statusMsg.type === 'error' ? 'destructive' : 'default'} className="bg-card">
          {statusMsg.type === 'success' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{statusMsg.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{statusMsg.text}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col flex-1 overflow-hidden min-h-0 shadow">
        <CardHeader className="border-b bg-muted/40 shrink-0">
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            NVR Recording Policies
          </CardTitle>
          <CardDescription>
            These settings govern the lifecycle of `.mp4` and `.mkv` files inside your local recordings folder.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-8 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading configurations...</div>
          ) : (
            <>
              {/* Retention Days */}
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <Label className="text-base font-semibold">Recording Retention Period</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Number of days to keep video clips before marking them eligible for cleanup.
                    </p>
                  </div>
                  <span className="font-mono font-bold text-lg text-primary bg-primary/10 px-3 py-1 rounded">
                    {retentionDays} {retentionDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
                <Slider
                  value={[retentionDays]}
                  min={1}
                  max={60}
                  step={1}
                  onValueChange={(val) => {
                    if (Array.isArray(val)) setRetentionDays(val[0]);
                    else if (typeof val === 'number') setRetentionDays(val);
                  }}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>1 Day (24 hrs)</span>
                  <span>14 Days (2 Weeks)</span>
                  <span>30 Days (1 Month)</span>
                  <span>60 Days (2 Months)</span>
                </div>
              </div>

              {/* Max Storage Limit */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between items-baseline">
                  <div>
                    <Label className="text-base font-semibold">Maximum Storage Pool</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Maximum disk space threshold dedicated for NVR camera streams on the hard drive.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={maxStorageGB}
                      onChange={(e) => setMaxStorageGB(Math.max(10, Number(e.target.value)))}
                      className="w-24 text-right font-mono"
                    />
                    <span className="font-bold text-sm">GB</span>
                  </div>
                </div>
                <Slider
                  value={[maxStorageGB]}
                  min={50}
                  max={2000}
                  step={50}
                  onValueChange={(val) => {
                    if (Array.isArray(val)) setMaxStorageGB(val[0]);
                    else if (typeof val === 'number') setMaxStorageGB(val);
                  }}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>50 GB</span>
                  <span>500 GB</span>
                  <span>1000 GB (1 TB)</span>
                  <span>2000 GB (2 TB)</span>
                </div>
              </div>

              {/* Auto Delete Switch */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t">
                <div>
                  <Label className="text-base font-semibold">Auto-Delete Oldest Files</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                    If enabled, the NVR background worker automatically purges oldest clips when the max storage limit is exceeded or the retention period expires.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={autoDelete}
                    onCheckedChange={setAutoDelete}
                    id="auto-delete"
                  />
                  <Label htmlFor="auto-delete" className="text-sm font-semibold cursor-pointer">
                    {autoDelete ? 'Enabled (Automatic Purge)' : 'Disabled (Manual Purge Only)'}
                  </Label>
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="border-t bg-muted/20 p-4 justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={loadConfigs} disabled={loading || saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}