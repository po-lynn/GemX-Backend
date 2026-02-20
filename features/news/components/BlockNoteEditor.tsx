"use client";

import { useCallback, useRef } from "react";
import { MantineProvider } from "@mantine/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import type { PartialBlock } from "@blocknote/core";

function parseInitialContent(content: string | null | undefined): PartialBlock[] | undefined {
  if (!content || !content.trim()) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[];
    return undefined;
  } catch {
    return undefined;
  }
}

type Props = {
  name: string;
  initialContent?: string | null;
};

export function BlockNoteEditor({ name, initialContent }: Props) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const initial = parseInitialContent(initialContent);

  const editor = useCreateBlockNote({
    initialContent: initial,
  });

  const handleChange = useCallback(() => {
    if (!editor.document || !hiddenInputRef.current) return;
    const json = JSON.stringify(editor.document);
    hiddenInputRef.current.value = json;
  }, [editor]);

  return (
    <MantineProvider>
      <div className="bn-editor-wrapper rounded-md border border-input bg-background [&_.bn-editor]:min-h-[280px]">
        <BlockNoteView editor={editor} onChange={handleChange} />
        <input
          type="hidden"
          ref={hiddenInputRef}
          name={name}
          defaultValue={initial ? JSON.stringify(initial) : "[]"}
        />
      </div>
    </MantineProvider>
  );
}
