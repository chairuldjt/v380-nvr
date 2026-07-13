'use client';

import * as React from 'react';
import { HardDrive, Save, RefreshCw, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSystemConfig, updateSystemConfig } from '@/lib/api';

const TIMEZONE_OPTIONS = [
  // Indonesia
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA, UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT, UTC+9)' },
  // Asia Lainnya
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho Chi Minh (ICT, UTC+7)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PHT, UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST, UTC+9)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  // Australia
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST, UTC+8)' },
  // Eropa
  { value: 'Europe/London', label: 'Europe/London (GMT, UTC+0)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK, UTC+3)' },
  // Amerika
  { value: 'America/New_York', label: 'America/New York (EST, UTC-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST, UTC-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST, UTC-8)' },
  // Universal
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

export default function StorageSettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [retentionDays, setRetentionDays] = React.useState<number>(7);
  const [maxStorageGB, setMaxStorageGB] = React.useState<number>(500);
  const [autoDelete, setAutoDelete] = React.useState<boolean>(true);
  const [timezone, setTimezone] = React.useState<string>('Asia/Jakarta');

  const loadConfigs = React.useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const data = await getSystemConfig();
      if (data.retentionDays !== undefined) setRetentionDays(Number(data.retentionDays));
      if (data.maxStorageGB !== undefined) setMaxStorageGB(Number(data.maxStorageGB));
      if (data.autoDelete !== undefined) setAutoDelete(data.autoDelete === true || data.autoDelete === 'true');
      if (data.timezone) setTimezone(data.timezone);
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
        autoDelete,
        timezone
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

              {/* Recording Timezone */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Recording Timezone
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      Timezone used for recording filenames and playback date filtering.
                      Set this to match your local timezone so playback dates are correct.
                    </p>
                  </div>
                  <Select value={timezone} onValueChange={(val) => { if (val) setTimezone(val); }}>
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Indonesia</SelectLabel>
                        {TIMEZONE_OPTIONS.filter(tz => tz.value.startsWith('Asia/Jakarta') || tz.value.startsWith('Asia/Makassar') || tz.value.startsWith('Asia/Jayapura')).map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Asia Lainnya</SelectLabel>
                        {TIMEZONE_OPTIONS.filter(tz => tz.value.startsWith('Asia/') && !['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'].includes(tz.value)).map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Lainnya</SelectLabel>
                        {TIMEZONE_OPTIONS.filter(tz => !tz.value.startsWith('Asia/')).map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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