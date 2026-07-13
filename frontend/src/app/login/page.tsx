"use client"

import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            V380 Network Video Recorder
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-zinc-900 lg:block overflow-hidden border-l border-border">
        {/* Abstract background mimicking a security grid or camera array */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-full h-full">
          <div className="grid grid-cols-2 gap-4 w-3/4 max-w-lg opacity-20">
            <div className="aspect-video bg-zinc-800 rounded-md border border-zinc-700 relative shadow-2xl">
               <div className="absolute top-2 left-2 flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div></div>
            </div>
            <div className="aspect-video bg-zinc-800 rounded-md border border-zinc-700 relative shadow-2xl"></div>
            <div className="aspect-video bg-zinc-800 rounded-md border border-zinc-700 relative shadow-2xl"></div>
            <div className="aspect-video bg-zinc-800 rounded-md border border-zinc-700 relative shadow-2xl">
               <div className="absolute top-2 left-2 flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
