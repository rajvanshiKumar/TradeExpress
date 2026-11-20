"use client";

import React from "react";

interface FormattedMessageProps {
  content: string;
  isUser?: boolean;
}

export function FormattedMessage({ content, isUser = false }: FormattedMessageProps) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Parse basic markdown: bold (**text**), bullet points (• or -), inline code (`code`)
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-slate-800">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lIdx} className="h-1" />;

        // Check if line is a bullet point
        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("* ");
        const lineContent = isBullet ? trimmed.replace(/^[•\-\*]\s*/, "") : trimmed;

        // Parse inline bold (**...**) and inline code (`...`)
        const parts = [];
        let remaining = lineContent;
        let pIdx = 0;

        while (remaining.length > 0) {
          // Check for bold **text**
          const boldMatch = remaining.match(/^([\s\S]*?)\*\*(.+?)\*\*([\s\S]*)$/);
          // Check for inline code `code`
          const codeMatch = remaining.match(/^([\s\S]*?)`(.+?)`([\s\S]*)$/);

          if (boldMatch && (!codeMatch || remaining.indexOf("**") <= remaining.indexOf("`"))) {
            if (boldMatch[1]) {
              parts.push(<span key={pIdx++}>{boldMatch[1]}</span>);
            }
            parts.push(
              <strong key={pIdx++} className="font-semibold text-slate-900">
                {boldMatch[2]}
              </strong>
            );
            remaining = boldMatch[3];
          } else if (codeMatch) {
            if (codeMatch[1]) {
              parts.push(<span key={pIdx++}>{codeMatch[1]}</span>);
            }
            parts.push(
              <code
                key={pIdx++}
                className="bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded text-[11px] font-mono font-medium border border-indigo-100"
              >
                {codeMatch[2]}
              </code>
            );
            remaining = codeMatch[3];
          } else {
            parts.push(<span key={pIdx++}>{remaining}</span>);
            break;
          }
        }

        if (isBullet) {
          return (
            <div key={lIdx} className="flex items-start gap-1.5 pl-1 text-slate-700">
              <span className="text-indigo-600 font-bold text-xs select-none">•</span>
              <span className="flex-1">{parts}</span>
            </div>
          );
        }

        return (
          <p key={lIdx} className="text-slate-800">
            {parts}
          </p>
        );
      })}
    </div>
  );
}
