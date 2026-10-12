export const readStore = (key, fallback) => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};
export const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value));
export const attendancePercent = (student) => {
  if (!student || !Number(student.conducted) || Number(student.conducted) < 1) return null;
  return Math.round((Number(student.attended) / Number(student.conducted)) * 10000) / 100;
};
export const statusClass = (status) => status.toLowerCase().replaceAll(" ", "-");
export const today = () => new Date().toISOString().slice(0, 10);
export const downloadText = (filename, text, type = "text/csv;charset=utf-8;") => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};