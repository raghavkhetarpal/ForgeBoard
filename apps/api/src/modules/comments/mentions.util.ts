export function extractMentions(content: string): string[] {
  const emailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const mentions = new Set<string>();
  let match;
  while ((match = emailRegex.exec(content)) !== null) {
    mentions.add(match[1].toLowerCase());
  }
  return Array.from(mentions);
}
