const potentialGrade = (potential: number) => {
  if (!potential || potential === null) return { label: "?", class: "unknown" };

  if (potential >= 95) return { label: "A+", class: "a-plus" };
  if (potential >= 90) return { label: "A", class: "a" };
  if (potential >= 85) return { label: "B+", class: "b-plus" };
  if (potential >= 80) return { label: "B", class: "b" };
  if (potential >= 75) return { label: "C+", class: "c-plus" };
  if (potential >= 70) return { label: "C", class: "c" };
  if (potential >= 60) return { label: "D+", class: "d-plus" };
  if (potential >= 50) return { label: "D", class: "d" };
  if (potential < 50) return { label: "F", class: "f" };
};

export { potentialGrade };
