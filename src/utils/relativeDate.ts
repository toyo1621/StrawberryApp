const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const formatRelativeDay = (createdAt: string): string => {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const daysAgo = Math.max(
    0,
    Math.floor((today.getTime() - targetDate.getTime()) / DAY_IN_MS),
  );

  if (daysAgo === 0) {
    return '今日';
  }

  return `${daysAgo}日前`;
};
