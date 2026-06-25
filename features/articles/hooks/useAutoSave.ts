"use client";

import { useEffect, useRef, useState } from "react";
import { autoSaveArticleAction } from "@/features/articles/actions/articles";

export type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

type Options = {
  id: string;
  title: string;
  author: string;
  content: string;
  enabled: boolean;
  debounceMs?: number;
};

type Return = {
  autoSaveState: AutoSaveState;
  lastAutoSaved: Date | null;
};

export function useAutoSave({
  id,
  title,
  author,
  content,
  enabled,
  debounceMs = 3000,
}: Options): Return {
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!enabled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoSaveState("pending");

    const timer = setTimeout(() => {
      if (!title.trim()) return;

      setAutoSaveState("saving");

      const formData = new FormData();
      formData.set("articleId", id);
      formData.set("title", title);
      formData.set("author", author);
      formData.set("content", content);

      autoSaveArticleAction(formData)
        .then((result) => {
          if (result?.error) {
            setAutoSaveState("error");
          } else {
            setAutoSaveState("saved");
            setLastAutoSaved(new Date());
          }
        })
        .catch(() => setAutoSaveState("error"));
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [id, title, author, content, enabled, debounceMs]);

  return { autoSaveState, lastAutoSaved };
}
