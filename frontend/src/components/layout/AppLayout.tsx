'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MonitorPlay,
  Settings,
  History,
  ScrollText,
  User,
  LogOut,
  Menu,
  Video
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactNode;
  }[];
}

function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1', className)} {...props}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {item.icon}
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

const navItems = [
  {
    title: 'Live View',
    href: '/live',
    icon: <MonitorPlay className="h-4 w-4" />,
  },
  {
    title: 'Playback',
    href: '/playback',
    icon: <History className="h-4 w-4" />,
  },
  {
    title: 'Configuration',
    href: '/config',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    title: 'Log Info',
    href: '/logs',
    icon: <ScrollText className="h-4 w-4" />,
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('nvr_token');
    if (!token) {
      router.replace('/login');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  if (isAuthorized === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('nvr_token');
    router.replace('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-muted/30 lg:flex">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <Link href="/live" className="flex items-center gap-2 font-semibold">
            <Video className="h-6 w-6 text-primary" />
            <span className="text-lg">V380 NVR</span>
          </Link>
        </div>
        <ScrollArea className="flex-1 py-4">
          <div className="px-4">
            <SidebarNav items={navItems} />
          </div>
        </ScrollArea>
        <div className="mt-auto border-t p-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Admin</span>
              <span className="text-xs text-muted-foreground">admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b bg-muted/30 px-4 lg:h-[60px] lg:px-6">
          <Sheet>
            <SheetTrigger render={
              <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            } />
            <SheetContent side="left" className="flex w-72 flex-col">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/live" className="flex items-center gap-2 font-semibold">
                  <Video className="h-6 w-6 text-primary" />
                  <span className="text-lg">V380 NVR</span>
                </Link>
              </div>
              <ScrollArea className="flex-1 py-4">
                <SidebarNav items={navItems} className="flex-col space-y-1 space-x-0" />
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <div className="w-full flex-1">
            {/* Can add search or breadcrumbs here later */}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>AD</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            } />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-muted/10">
          {children}
        </main>
      </div>
    </div>
  );
}
