"use client"

import { useEffect, type MutableRefObject } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const DOC_EDITOR_STORAGE_KEY = "tans-agents:doc-editor-content-v1"

export type DocEditorHandle = {
  insertContent: (content: string) => void
  replaceSelection: (content: string) => void
  getSelectionText: () => string
  getHTML: () => string
  appendContent: (content: string) => void
}

type DocEditorProps = {
  initialContent?: string
  onChange?: (html: string) => void
  editorRef: MutableRefObject<DocEditorHandle | null>
}

function readSavedContent(initialContent: string) {
  if (typeof window === "undefined") return initialContent
  try {
    return window.localStorage.getItem(DOC_EDITOR_STORAGE_KEY) ?? initialContent
  } catch {
    return initialContent
  }
}

function selectedText(editor: Editor) {
  const { from, to } = editor.state.selection
  if (from === to) return ""
  return editor.state.doc.textBetween(from, to, "\n")
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

export function DocEditor({ initialContent = "", onChange, editorRef }: DocEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            class: "text-primary underline underline-offset-4",
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
    ],
    content: readSavedContent(initialContent),
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[calc(100vh-14rem)] px-5 py-4 text-sm leading-7 text-foreground outline-none",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
          "[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold",
          "[&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:ml-5 [&_ul]:list-disc"
        ),
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const html = activeEditor.getHTML()
      try {
        window.localStorage.setItem(DOC_EDITOR_STORAGE_KEY, html)
      } catch {
        /* ignore localStorage quota/privacy errors */
      }
      onChange?.(html)
    },
  })

  useEffect(() => {
    if (!editor) {
      editorRef.current = null
      return
    }

    editorRef.current = {
      insertContent(content) {
        editor.chain().focus().insertContent(content).run()
      },
      replaceSelection(content) {
        editor.chain().focus().deleteSelection().insertContent(content).run()
      },
      getSelectionText() {
        return selectedText(editor)
      },
      getHTML() {
        return editor.getHTML()
      },
      appendContent(content) {
        editor.chain().focus("end").insertContent(content).run()
      },
    }

    return () => {
      editorRef.current = null
    }
  }, [editor, editorRef])

  const setLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Nhập URL", previousUrl ?? "https://")
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2">
        <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Ordered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Code block" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Blockquote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor?.isActive("link")} onClick={setLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-6 w-px bg-border" />
        <ToolbarButton label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto" />
    </div>
  )
}
