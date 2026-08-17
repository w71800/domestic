"use client";

import { useState } from "react";

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // LINE WebView 有時不給 clipboard API，改用選取複製。
    }
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(input);
  return ok;
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(value);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
    >
      {copied ? "已複製" : "複製"}
    </button>
  );
}
