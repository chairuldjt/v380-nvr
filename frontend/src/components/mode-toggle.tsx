"use client"
import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Toggle Theme"
      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
    >
      <Sun className="h-4 w-4 transition-transform duration-300 scale-100 dark:scale-0 dark:rotate-90" />
      <Moon className="absolute h-4 w-4 transition-transform duration-300 scale-0 rotate-90 dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
