"use client"

import { Check, Package2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WORKSPACE_PACKS, getWorkspacePack } from "@/lib/workspace-packs"
import { cn } from "@/lib/utils"

type WorkspacePackPickerProps = {
  value: string
  onChange: (id: string) => void
}

export function WorkspacePackPicker({ value, onChange }: WorkspacePackPickerProps) {
  const current = getWorkspacePack(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-xs">
          <Package2 className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Workspace Pack</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {WORKSPACE_PACKS.map((pack) => (
          <DropdownMenuItem
            key={pack.id}
            onClick={() => onChange(pack.id)}
            className={cn("items-start gap-2", pack.id === current.id && "bg-accent")}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{pack.label}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {pack.autoProfile}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{pack.description}</p>
            </div>
            {pack.id === current.id && <Check className="mt-0.5 h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
