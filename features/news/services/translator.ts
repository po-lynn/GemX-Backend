import { env } from "@/data/env/server";

export type NewsLanguage = "Myanmar" | "English" | "Thai" | "Korean";

const languageToCode: Record<NewsLanguage, string> = {
  Myanmar: "my",
  English: "en",
  Thai: "th",
  Korean: "ko",
};

function getAzureConfig() {
  const key = env.AZURE_TRANSLATOR_KEY;
  const region = env.AZURE_TRANSLATOR_REGION;
  const endpoint = env.AZURE_TRANSLATOR_ENDPOINT ?? "https://api.cognitive.microsofttranslator.com";
  if (!key || !region) {
    throw new Error("Azure Translator is not configured");
  }
  return { key, region, endpoint };
}

async function translateTextsAzure(params: {
  from: NewsLanguage;
  to: NewsLanguage;
  texts: string[];
}): Promise<string[]> {
  const { key, region, endpoint } = getAzureConfig();
  if (params.texts.length === 0) return [];
  const url = new URL("/translate", endpoint);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("from", languageToCode[params.from]);
  url.searchParams.set("to", languageToCode[params.to]);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.texts.map((text) => ({ Text: text }))),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Azure Translator request failed (${res.status}) ${txt}`.trim());
  }

  const data = (await res.json()) as Array<{ translations?: Array<{ text?: string }> }>;
  return data.map((row, idx) => row.translations?.[0]?.text ?? params.texts[idx] ?? "");
}

function translateBlockNoteContent(content: string, translatedTexts: string[]): string {
  const parsed = JSON.parse(content);
  let cursor = 0;
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const rec = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (k === "text" && typeof v === "string") {
        out[k] = translatedTexts[cursor] ?? v;
        cursor += 1;
      } else {
        out[k] = visit(v);
      }
    }
    return out;
  };
  return JSON.stringify(visit(parsed));
}

function extractBlockNoteTexts(content: string): string[] {
  const parsed = JSON.parse(content);
  const texts: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (k === "text" && typeof v === "string") texts.push(v);
      else visit(v);
    }
  };
  visit(parsed);
  return texts;
}

export async function buildNewsTranslations(params: {
  sourceLanguage: NewsLanguage;
  title: string;
  content: string;
}): Promise<Array<{ language: NewsLanguage; title: string; content: string }>> {
  const targets = (Object.keys(languageToCode) as NewsLanguage[]).filter(
    (lang) => lang !== params.sourceLanguage
  );

  const sourceContentTexts = extractBlockNoteTexts(params.content);
  const out: Array<{ language: NewsLanguage; title: string; content: string }> = [];

  for (const target of targets) {
    const [translatedTitle] = await translateTextsAzure({
      from: params.sourceLanguage,
      to: target,
      texts: [params.title],
    });

    const translatedContentTexts = await translateTextsAzure({
      from: params.sourceLanguage,
      to: target,
      texts: sourceContentTexts,
    });

    out.push({
      language: target,
      title: translatedTitle,
      content: translateBlockNoteContent(params.content, translatedContentTexts),
    });
  }
  return out;
}
