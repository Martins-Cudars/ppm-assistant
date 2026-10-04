/**
 * The one-line note the scouting views put above a table, so a visit shows
 * that it was stored - capture is otherwise invisible.
 */
export function showScoutNote(anchor: Element, text: string): void {
  const id = "ppm-assistant-scout-note";
  const note = document.getElementById(id) ?? document.createElement("div");
  note.id = id;
  note.textContent = `PPM Assistant: ${text}`;
  note.setAttribute("style", "text-align:left;font-size:12px;color:#555;padding:4px 0;");
  if (!note.parentNode) anchor.parentNode?.insertBefore(note, anchor);
}
