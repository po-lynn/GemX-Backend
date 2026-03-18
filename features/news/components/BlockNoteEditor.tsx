"use client";

import { useCallback, useRef } from "react";
import { MantineProvider } from "@mantine/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";
import type { PartialBlock } from "@blocknote/core";
import { authClient } from "@/lib/auth-client";

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

  const { data: session } = authClient.useSession();
  const token = (() => {
    if (!session) return undefined;
    const maybeToken = (session as unknown as { token?: string }).token;
    if (typeof maybeToken === "string") return maybeToken;
    const maybeNestedToken = (session as unknown as {
      session?: { token?: string };
    }).session?.token;
    return typeof maybeNestedToken === "string" ? maybeNestedToken : undefined;
  })();

  const editor = useCreateBlockNote({
    initialContent: initial,
    uploadFile: async (file) => {
      if (!token) {
        throw new Error("Unauthorized. Please sign in and try again.");
      }

      const formData = new FormData();
      formData.append("type", "image");
      formData.append("file", file);

      const res = await fetch("/api/upload/product-media", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const jsonUnknown: unknown = await res.json().catch(() => undefined);
      const data =
        jsonUnknown && typeof jsonUnknown === "object"
          ? (jsonUnknown as { urls?: string[]; url?: string; error?: string })
          : {};

      if (!res.ok) {
        throw new Error(data?.error ?? "Image upload failed");
      }

      const url = data?.urls?.[0] ?? data?.url;
      if (!url) throw new Error("Upload succeeded but no URL returned.");

      // BlockNote expects either a URL string or an object to set file block props.
      return url;
    },
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
