/**
 * Converts a standard JavaScript Date object into a Star Trek TNG-era Stardate.
 * 
 * Note: This uses a continuous calculation based on the TNG epoch (2323 = Stardate 00000.0).
 * It projects our current dates 377 years into the future to match the 25th century.
 * 
 * @param {Date|string|number} dateInput - The date to convert
 * @returns {string} The formatted Stardate (e.g., "51243.5")
 */
export const calculateStardate = (dateInput) => {
  const date = new Date(dateInput);
  const year = date.getFullYear();

  // Day of the year (Jan 1 = 1) from the local calendar date. Computed in UTC
  // so DST shifts can't make a local midnight count as the previous day.
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear =
    (Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 0)) / oneDay;

  const trekYear = year + 377; // Shift 2024 to 2401
  const stardateYear = 1000 * (trekYear - 2323);
  const stardateDay = (dayOfYear / 365.25) * 1000;

  return (stardateYear + stardateDay).toFixed(1);
};