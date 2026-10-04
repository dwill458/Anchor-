/** Prefer a sentence, otherwise a whole word; native ellipsizing can split words. */
export function truncateVisionText(text: string, limit = 210): string {
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit + 1);
  const sentences = [...prefix.matchAll(/[.!?](?=\s)/g)];
  const sentence = sentences[sentences.length - 1];
  const wordEnd = prefix.search(/\s+\S*$/);
  const end = sentence ? sentence.index! : wordEnd > 0 ? wordEnd : text.search(/\s/);
  // An indivisible token has no legal word boundary. Preserve it rather than
  // inventing a mid-word cut or claiming hidden content with a false ellipsis.
  if (end <= 0) return text;
  return `${text.slice(0, end).trimEnd()}...`;
}
