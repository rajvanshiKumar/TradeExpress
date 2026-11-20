"use client";

import dynamic from "next/dynamic";

export const ChatWidget = dynamic(
  () => import("./chat/ChatWidget").then((m) => m.ChatWidget),
  { ssr: false }
);

export default ChatWidget;
