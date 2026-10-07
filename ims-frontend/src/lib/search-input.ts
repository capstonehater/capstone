// Match emoji sequences without removing ordinary digits, punctuation, or accented text.
export function removeSearchEmojis(value: string): string {
  return value.replace(/[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]/gu, "");
}
