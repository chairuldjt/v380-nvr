'use client';

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Video } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        throw new Error('Invalid credentials')
      }

      const data = await res.json()

      if (data.token) {
        localStorage.setItem('nvr_token', data.token)
        router.push('/live')
      } else {
        throw new Error('No token received')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleLogin} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground mb-4">
            <Video className="size-6" />
          </div>
          <h1 className="text-2xl font-bold">V380 NVR Login</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your credentials to access the system
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm font-medium text-destructive bg-destructive/10 rounded-md text-center">
            {error}
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            type="text"
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Field>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Login'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
