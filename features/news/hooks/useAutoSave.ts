"use client";

import { useEffect, useRef, useState } from "react";
import { autoSaveNewsAction } from "@/features/news/actions/news";

export type AutoSaveState = "idle" | "pending" | "saving" | "saved" | "error";

type Options = {
  id: string;
  title: string;
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
      formData.set("newsId", id);
      formData.set("title", title);
      formData.set("content", content);

      autoSaveNewsAction(formData)
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
  }, [id, title, content, enabled, debounceMs]);

  return { autoSaveState, lastAutoSaved };
}
