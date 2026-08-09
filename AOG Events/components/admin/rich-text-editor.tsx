"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Link2Off,
  RemoveFormatting,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  minHeight = "120px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose-editor focus:outline-none",
        style: `min-height:${minHeight};padding:12px;`,
      },
    },
  });

  // Sync external value changes (e.g. template switch)
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered list">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          active={editor.isActive("table")}
          title="Insert table"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {editor.isActive("table") && (
          <>
            <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">
              <Rows3 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">
              <Columns3 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
              <Trash2 className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        )}

        <Divider />

        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Insert link">
          <Link2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} active={false} title="Remove link">
          <Link2Off className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        {/* Font colour */}
        <label title="Text colour" className="relative cursor-pointer p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <span className="text-xs font-bold leading-none">A</span>
          <input
            type="color"
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            defaultValue="#ffffff"
          />
        </label>

        <Divider />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
          active={false}
          title="Clear formatting"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <style>{`
        .prose-editor p { margin: 0 0 10px; line-height: 1.6; }
        .prose-editor h1 { font-size: 1.4em; font-weight: 700; margin: 0 0 8px; }
        .prose-editor h2 { font-size: 1.2em; font-weight: 700; margin: 0 0 8px; }
        .prose-editor h3 { font-size: 1.05em; font-weight: 600; margin: 0 0 8px; }
        .prose-editor ul { list-style: disc; padding-left: 1.25rem; margin: 0 0 10px; }
        .prose-editor ol { list-style: decimal; padding-left: 1.25rem; margin: 0 0 10px; }
        .prose-editor li { margin-bottom: 4px; }
        .prose-editor a { color: #FF6C00; text-decoration: underline; }
        .prose-editor strong { font-weight: 700; }
        .prose-editor em { font-style: italic; }
        .prose-editor u { text-decoration: underline; }
        .prose-editor s { text-decoration: line-through; }
        .prose-editor table { border-collapse: collapse; width: 100%; margin: 0 0 10px; table-layout: fixed; }
        .prose-editor th, .prose-editor td { border: 1px solid hsl(var(--border)); padding: 6px 10px; position: relative; vertical-align: top; }
        .prose-editor th { background: hsl(var(--secondary)); font-weight: 600; text-align: left; }
        .prose-editor .selectedCell { background: hsl(var(--primary) / 0.12); }
        .prose-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}
