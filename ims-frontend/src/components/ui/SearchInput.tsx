"use client";

import type { ComponentPropsWithRef } from "react";
import { removeSearchEmojis } from "@/lib/search-input";

export default function SearchInput({ onBeforeInput, onChange, onKeyDown, ...props }: ComponentPropsWithRef<"input">) {
  return (
    <input
      {...props}
      onKeyDown={event => {
        if (!event.ctrlKey && !event.metaKey && removeSearchEmojis(event.key) !== event.key) event.preventDefault();
        onKeyDown?.(event);
      }}
      onBeforeInput={event => {
        const data = (event.nativeEvent as InputEvent).data;
        if (data && removeSearchEmojis(data) !== data) event.preventDefault();
        onBeforeInput?.(event);
      }}
      onChange={event => {
        const input = event.currentTarget;
        const original = input.value;
        const cleaned = removeSearchEmojis(original);
        if (cleaned !== original) {
          const cursor = input.selectionStart;
          input.value = cleaned;
          if (cursor !== null) {
            const nextCursor = removeSearchEmojis(original.slice(0, cursor)).length;
            input.setSelectionRange(nextCursor, nextCursor);
          }
        }
        onChange?.(event);
      }}
    />
  );
}
