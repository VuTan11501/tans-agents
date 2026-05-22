"use client"

import { Copy, Play, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PROMPT_TEMPLATE_CATEGORY_LABELS, type PromptTemplate } from "@/lib/prompt-templates"

interface TemplateCardProps {
  template: PromptTemplate
  onUse: (template: PromptTemplate) => void
  onCopy: (template: PromptTemplate) => void
  onDelete?: (template: PromptTemplate) => void
}

export function TemplateCard({ template, onUse, onCopy, onDelete }: TemplateCardProps) {
  const preview = template.body.length > 60 ? `${template.body.slice(0, 60)}...` : template.body

  return (
    <Card className="flex h-full flex-col transition-colors hover:bg-accent/40">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {template.icon || "✨"}
            </span>
            <CardTitle className="truncate text-base">{template.title}</CardTitle>
          </div>
          <Badge variant={template.isBuiltin ? "secondary" : "outline"} className="shrink-0">
            {PROMPT_TEMPLATE_CATEGORY_LABELS[template.category]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pb-4">
        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{preview}</p>
        {template.variables.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.variables.map((variable) => (
              <Badge key={variable} variant="outline" className="font-mono text-[10px]">
                {`{{${variable}}}`}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 pt-0">
        <Button type="button" size="sm" onClick={() => onUse(template)} className="gap-2">
          <Play className="h-3.5 w-3.5" /> Sử dụng
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onCopy(template)} className="gap-2">
          <Copy className="h-3.5 w-3.5" /> Sao chép
        </Button>
        {!template.isBuiltin && onDelete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDelete(template)}
            className="ml-auto gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Xoá
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
