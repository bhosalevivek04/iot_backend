function getDateX(msAgo) {
  return new Date(Date.now() - msAgo);
}

function getMonthWeekRange(year, month, weekNumber) {
  const startDay = (weekNumber - 1) * 7 + 1;
  const endDay = weekNumber * 7;
  const start = new Date(year, month, startDay);
  const end = new Date(year, month, endDay, 23, 59, 59, 999);
  return { start, end };
}

module.exports = { getDateX, getMonthWeekRange };