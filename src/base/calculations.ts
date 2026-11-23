const calculateSkillWithExp = (skill: number, experience: number): number => {
  return Math.round(skill * (1 + experience / 500));
};

export { calculateSkillWithExp };
