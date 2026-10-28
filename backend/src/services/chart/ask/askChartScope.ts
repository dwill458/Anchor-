const norm = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

/** True when the proposed waypoints are the current ones: same titles in the same order. */
export function routeTitlesMatch(current: string[], proposed: string[]): boolean {
  if (current.length !== proposed.length) return false;
  return current.every((title, index) => norm(title) === norm(proposed[index]));
}
