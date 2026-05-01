export const DEFAULT_WEATHER_HOUR = 10;
export const MAX_FORECAST_DAYS = 16;

/**
 * Formats a Date for an input[type=date] value.
 *
 * @param {!Date} date Date.
 * @return {string} YYYY-MM-DD.
 */
export function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date input value.
 *
 * @return {string} YYYY-MM-DD.
 */
export function getTodayInputValue() {
  return formatDateInputValue(new Date());
}

/**
 * Returns the maximum forecast date supported by the free forecast API.
 *
 * @return {string} YYYY-MM-DD.
 */
export function getMaxForecastDateValue() {
  return formatDateInputValue(addDays(new Date(), MAX_FORECAST_DAYS - 1));
}

/**
 * Adds days to a date.
 *
 * @param {!Date} date Date.
 * @param {number} days Days to add.
 * @return {!Date} New date.
 */
export function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

/**
 * Clamps a date input value to the supported forecast range.
 *
 * @param {string} value Date input value.
 * @return {string} Clamped value.
 */
export function clampForecastDate(value) {
  const minimum = getTodayInputValue();
  const maximum = getMaxForecastDateValue();

  if (!isDateInputValue(value)) {
    return minimum;
  }

  if (value < minimum) {
    return minimum;
  }

  if (value > maximum) {
    return maximum;
  }

  return value;
}

/**
 * Returns whether a value is a valid date input string.
 *
 * @param {string} value Date value.
 * @return {boolean} Whether value is valid.
 */
export function isDateInputValue(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

/**
 * Normalizes an hour value.
 *
 * @param {number|string} hour Hour.
 * @return {number} Clamped integer hour.
 */
export function normalizeHour(hour) {
  const numericHour = Number(hour);

  if (!Number.isFinite(numericHour)) {
    return DEFAULT_WEATHER_HOUR;
  }

  return Math.min(Math.max(Math.round(numericHour), 0), 23);
}

/**
 * Formats an hour for display.
 *
 * @param {number} hour Hour.
 * @return {string} Display label.
 */
export function formatHourLabel(hour) {
  const normalizedHour = normalizeHour(hour);
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHour % 12 || 12;

  return `${hour12}:00 ${suffix}`;
}

/**
 * Creates hour select options.
 *
 * @return {!Array<{value: string, label: string}>} Hour options.
 */
export function createHourOptions() {
  return Array.from({length: 24}, (_, hour) => ({
    value: String(hour),
    label: formatHourLabel(hour),
  }));
}

/**
 * Moves a date/hour pair by an hour.
 *
 * @param {string} dateValue Date input value.
 * @param {number} hour Hour.
 * @param {number} deltaHours Hour delta.
 * @return {{date: string, hour: number}} Next selection.
 */
export function addHoursToSelection(dateValue, hour, deltaHours) {
  const date = new Date(`${clampForecastDate(dateValue)}T00:00:00`);
  date.setHours(normalizeHour(hour) + deltaHours, 0, 0, 0);
  const minimum = getTodayInputValue();
  const maximum = getMaxForecastDateValue();
  const nextDate = formatDateInputValue(date);

  if (nextDate < minimum) {
    return {
      date: minimum,
      hour: 0,
    };
  }

  if (nextDate > maximum) {
    return {
      date: maximum,
      hour: 23,
    };
  }

  return {
    date: nextDate,
    hour: normalizeHour(date.getHours()),
  };
}
