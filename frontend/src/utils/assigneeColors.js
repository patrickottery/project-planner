const PALETTE = [
  "#6366f1","#ec4899","#f59e0b","#10b981",
  "#3b82f6","#8b5cf6","#ef4444","#14b8a6",
  "#f97316","#84cc16","#06b6d4","#a855f7",
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function assigneeColor(name) {
  if (!name) return "#8892a4";
  return PALETTE[hash(name) % PALETTE.length];
}

export function assigneeInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
