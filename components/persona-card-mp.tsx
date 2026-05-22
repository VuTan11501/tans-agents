"use client"

import { Download, Heart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { MarketplacePersona } from "@/lib/personas-share"
import { cn } from "@/lib/utils"

interface PersonaCardMpProps {
  persona: MarketplacePersona
  upvoteCount: number
  upvoted: boolean
  imported: boolean
  onImport: (persona: MarketplacePersona) => void
  onUpvote: (persona: MarketplacePersona) => void
}

export function PersonaCardMp({
  persona,
  upvoteCount,
  upvoted,
  imported,
  onImport,
  onUpvote,
}: PersonaCardMpProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
              {persona.emoji || "✨"}
            </div>
            <div className="min-w-0">
              <CardTitle className="line-clamp-1 text-base">{persona.name}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                bởi <span className="font-medium text-foreground">{persona.sharedBy}</span>
              </p>
            </div>
          </div>
          <Badge variant={persona.isSeed ? "secondary" : "outline"} className="shrink-0 capitalize">
            {persona.category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">{persona.description}</p>
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {persona.systemPrompt}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("gap-1.5", upvoted && "text-rose-500 hover:text-rose-500")}
          aria-pressed={upvoted}
          onClick={() => onUpvote(persona)}
        >
          <Heart className={cn("h-4 w-4", upvoted && "fill-current")} />
          <span>{upvoteCount}</span>
        </Button>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => onImport(persona)}>
          <Download className="h-4 w-4" />
          {imported ? "Đã import" : "Import vào tài khoản"}
        </Button>
      </CardFooter>
    </Card>
  )
}
