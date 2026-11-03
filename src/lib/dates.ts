/** Local calendar date as YYYY-MM-DD (sorts and compares correctly as a string with ISO dates). */
export const localToday = () => new Date().toLocaleDateString("en-CA");
