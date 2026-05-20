"use client"

import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PERSONAS, getPersona, type PersonaId } from "@/lib/personas"
import { cn } from "@/lib/utils"

interface PersonaPickerProps {
  value: PersonaId
  onChange: (persona: PersonaId) => void
}

export function PersonaPicker({ value, onChange }: PersonaPickerProps) {
  const current = getPersona(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium hover:bg-muted/50"
          aria-label="Chọn persona"
        >
          <span>{current.emoji}</span>
          <span className="hidden sm:inline">{current.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuLabel>Persona</DropdownMenuLabel>
        {PERSONAS.map((persona) => {
          const selected = persona.id === value
          return (
            <DropdownMenuItem
              key={persona.id}
              onClick={() => onChange(persona.id)}
              className={cn("text-sm", selected && "bg-accent")}
            >
              <span className="text-base">{persona.emoji}</span>
              <span className="flex-1">{persona.label}</span>
              {selected && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
