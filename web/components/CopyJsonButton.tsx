"use client";

import { useState } from "react";

interface Props {
  arxivId: string;
}

export default function CopyJsonButton({ arxivId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const apiUrl = `/api/v1/papers/${arxivId}`;
  const curlCmd = `curl https://sotaverified.io/api/v1/papers/${arxivId}`;

  function copy() {
    navigator.clipboard.writeText(curlCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mb-8">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 transition-colors"
      >
        <span className="font-mono">{"{}"}</span>
        Copy JSON for Agent
        <span className="text-gray-300">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl bg-gray-950 border border-gray-800 p-4 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 font-mono">
              GET{" "}
              <a
                href={apiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                {apiUrl}
              </a>
            </span>
            <button
              onClick={copy}
              className="text-gray-400 hover:text-white transition-colors text-xs font-medium"
            >
              {copied ? "Copied!" : "Copy curl"}
            </button>
          </div>
          <pre className="text-green-400 overflow-x-auto">
            {curlCmd}
          </pre>
        </div>
      )}
    </div>
  );
}
