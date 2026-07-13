"use client"

import * as React from "react"
import { MonitorPlay, Settings, Video } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Helper to decode JWT without a heavy library
function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userProfile, setUserProfile] = React.useState({
    name: "Loading...",
    email: "operator@v380-nvr.local",
    avatar: "",
    role: "operator"
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('nvr_token');
      if (token) {
        const payload = decodeJwt(token);
        if (payload) {
          setUserProfile({
            name: payload.username,
            email: `${payload.role}@v380-nvr.local`,
            avatar: "",
            role: payload.role || 'operator'
          });
        }
      }
    }
  }, []);

  // Filter menu items dynamically based on role
  const isAdmin = userProfile.role === 'admin';

  const navItems = [
    {
      title: "Monitoring",
      url: "#",
      icon: <MonitorPlay />,
      isActive: true,
      items: [
        {
          title: "Live View",
          url: "/live",
        },
        {
          title: "Playback",
          url: "/playback",
        },
      ],
    },
  ];

  // Only push System settings if user is Admin
  if (isAdmin) {
    navItems.push({
      title: "System",
      url: "#",
      icon: <Settings />,
      isActive: true,
      items: [
        {
          title: "Camera Config",
          url: "/config",
        },
        {
          title: "Storage Settings",
          url: "/settings/storage",
        },
        {
          title: "User Management",
          url: "/settings/users",
        },
        {
          title: "System Logs",
          url: "/logs",
        },
      ],
    });
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="/live" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Video className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">V380 NVR</span>
                <span className="truncate text-xs">iTops Labs</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userProfile} />
      </SidebarFooter>
    </Sidebar>
  )
}
