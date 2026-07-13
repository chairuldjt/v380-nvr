'use client';

import * as React from 'react';
import { Download, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { fetchLogs } from '@/lib/api';
import { format } from 'date-fns';

export default function LogsPage() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [moduleFilter, setModuleFilter] = React.useState('all-modules');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs(typeFilter, moduleFilter, 100);
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadLogs();
  }, [typeFilter, moduleFilter]);

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Logs</h1>
          <p className="text-sm text-muted-foreground">
            View system events, user actions, and camera statuses.
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs}>
          <Filter className="mr-2 h-4 w-4" /> Refresh Logs
        </Button>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden min-h-0">
        <CardHeader className="p-4 border-b shrink-0 bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search logs..."
                  className="pl-8"
                />
              </div>
              <Button variant="secondary" className="shrink-0">
                Search
              </Button>
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Log Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="info">INFO</SelectItem>
                  <SelectItem value="warning">WARNING</SelectItem>
                  <SelectItem value="error">ERROR</SelectItem>
                </SelectContent>
              </Select>

              <Select value={moduleFilter} onValueChange={(val) => setModuleFilter(val || 'all-modules')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-modules">All Modules</SelectItem>
                  <SelectItem value="System">System</SelectItem>
                  <SelectItem value="V380Decoder">V380Decoder</SelectItem>
                  <SelectItem value="Recording">Recording</SelectItem>
                  <SelectItem value="Config">Config</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[180px]">Time</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[120px]">Module</TableHead>
                  <TableHead>Details / Action</TableHead>
                  <TableHead className="w-[120px]">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Loading system logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.level === 'ERROR' ? 'destructive' :
                            log.level === 'WARNING' ? 'secondary' : 'default'
                          }
                          className={
                            log.level === 'WARNING' ? 'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30' :
                            log.level === 'INFO' ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : ''
                          }
                        >
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.module}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{log.action}</div>
                        {log.details && (
                          <div className="text-xs text-muted-foreground max-w-[500px] truncate" title={log.details}>
                            {log.details}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.ip || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
