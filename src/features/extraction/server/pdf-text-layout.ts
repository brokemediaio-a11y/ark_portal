export interface PositionedText { text: string; x: number; y: number; width: number }

/** PDF object order is not reading order. Rebuild visual rows, then read left to right. */
export function textInReadingOrder(items: PositionedText[]): string {
  const rows: { y: number; items: PositionedText[] }[] = [];
  for (const item of [...items].filter(item => item.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const previous = rows.at(-1);
    if (previous && Math.abs(previous.y - item.y) <= 2) previous.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map(row => {
    const spans = row.items.sort((a, b) => a.x - b.x);
    return spans.reduce((line, span, index) => {
      if (!index) return span.text;
      const previous = spans[index - 1];
      const gap = span.x - (previous.x + previous.width);
      const separator = gap >= 18 ? " | " : /\s$/.test(line) || /^\s/.test(span.text) || gap < 2 ? "" : " ";
      return line + separator + span.text;
    }, "").trim();
  }).join("\n");
}
