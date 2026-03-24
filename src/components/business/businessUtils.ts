/**
 * Parse business hours string and determine if the business is currently open.
 * Cross-browser safe — works on Chrome, Safari, Firefox (desktop + mobile).
 *
 * Supports formats:
 *   - "Monday: 9:00 AM - 10:00 PM"
 *   - "Mon-Fri 11:00 am - 12:00 pm"
 *   - "Sat - Sun 10:00 am - 02:00 am"
 *   - "Mon: 9am-5pm"
 *   - "Mon-Fri: 09:00-22:00"
 *   - "Sunday: Closed"
 */
export function parseOpenNow(hours?: string): { isOpen: boolean; label: string } | null {
  if (!hours) return null;
  try {
    var now = new Date();
    var dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var today = dayNames[now.getDay()];
    var todayAbbr = today.slice(0, 3);
    var lines = hours.split('\n').map(function (l) { return l.trim().toLowerCase(); });

    // Find the line matching today (exact day name, abbreviation, or day range)
    var matchedLine: string | null = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.includes(today) || line.includes(todayAbbr)) {
        matchedLine = line;
        break;
      }
      // Check day ranges like "mon-fri", "mon - sat"
      var rangeMatch = line.match(/([a-z]{3})\s*[-\u2013]\s*([a-z]{3})/);
      if (rangeMatch) {
        var startIdx = dayNames.findIndex(function (d) { return d.startsWith(rangeMatch![1]); });
        var endIdx = dayNames.findIndex(function (d) { return d.startsWith(rangeMatch![2]); });
        var todayIdx = now.getDay();
        if (startIdx >= 0 && endIdx >= 0) {
          if (startIdx <= endIdx
            ? (todayIdx >= startIdx && todayIdx <= endIdx)
            : (todayIdx >= startIdx || todayIdx <= endIdx)) {
            matchedLine = line;
            break;
          }
        }
      }
    }

    if (!matchedLine) return null;
    if (matchedLine.includes('closed')) return { isOpen: false, label: 'Closed today' };

    // Extract all time-like tokens from the matched line
    var times: Array<{ h: number; m: number; ampm: string | null }> = [];
    var timeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
    var m: RegExpExecArray | null;
    while ((m = timeRe.exec(matchedLine)) !== null) {
      times.push({ h: parseInt(m[1], 10), m: parseInt(m[2] || '0', 10), ampm: m[3] || null });
    }
    if (times.length < 2) return null;

    var parseTime = function (t: { h: number; m: number; ampm: string | null }, idx: number): number {
      var hour = t.h;
      var min = t.m;
      if (t.ampm) {
        var ap = t.ampm.toLowerCase();
        if (ap === 'pm' && hour !== 12) hour += 12;
        if (ap === 'am' && hour === 12) hour = 0;
      } else if (hour >= 1 && hour <= 6 && idx === 1) {
        // Heuristic: bare numbers 1-6 likely mean PM for closing time
        hour += 12;
      }
      return hour * 60 + min;
    };

    var openMin = parseTime(times[0], 0);
    var closeMin = parseTime(times[1], 1);
    var nowMin = now.getHours() * 60 + now.getMinutes();

    if (nowMin >= openMin && nowMin < closeMin) {
      var minsLeft = closeMin - nowMin;
      if (minsLeft <= 60) return { isOpen: true, label: 'Closes in ' + minsLeft + 'm' };
      return { isOpen: true, label: 'Open' };
    } else {
      return { isOpen: false, label: 'Closed' };
    }
  } catch (e) {
    return null;
  }
}
