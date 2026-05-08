export function withAlpha(hexColor: string, opacity: number): string {
  const normalized = hexColor.replace('#', '');
  const chunkSize = normalized.length === 3 ? 1 : 2;
  const values = normalized.match(new RegExp(`.{1,${chunkSize}}`, 'g'));

  if (!values || values.length < 3) {
    return hexColor;
  }

  const [red, green, blue] = values.map((value) => {
    const expanded = chunkSize === 1 ? `${value}${value}` : value;
    return Number.parseInt(expanded, 16);
  });

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
