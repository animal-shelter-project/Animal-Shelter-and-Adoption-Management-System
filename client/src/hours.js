import { SHELTER } from './siteContent.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const clock = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

// Is the shelter open at `now`? Returns { open, text }, e.g.
//   { open: true,  text: 'Open now · closes at 7 pm' }
//   { open: false, text: 'Closed now · opens Tuesday at 11 am' }
export function openStatus(now = new Date(), schedule = SHELTER.schedule) {
  const day = now.getDay();
  const hour = now.getHours() + now.getMinutes() / 60;
  const today = schedule[day];
  if (today && hour >= today[0] && hour < today[1]) {
    return { open: true, text: `Open now · closes at ${clock(today[1])}` };
  }
  if (today && hour < today[0]) {
    return { open: false, text: `Closed now · opens today at ${clock(today[0])}` };
  }
  for (let i = 1; i <= 7; i += 1) {
    const d = (day + i) % 7;
    if (schedule[d]) {
      const when = i === 1 ? 'tomorrow' : DAY_NAMES[d];
      return { open: false, text: `Closed now · opens ${when} at ${clock(schedule[d][0])}` };
    }
  }
  return { open: false, text: 'Closed' };
}
