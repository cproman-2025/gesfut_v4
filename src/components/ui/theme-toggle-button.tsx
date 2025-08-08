"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggleButton() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid rendering theme-dependent UI until mounted on the client
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Cargando tema..." disabled>
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Cargando tema</span>
      </Button>
    )
  }

  const handleToggle = () => {
    setTheme(theme === "light" ? "dark" : "light")
  }

  const currentAriaLabel =
    theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      aria-label={currentAriaLabel}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
