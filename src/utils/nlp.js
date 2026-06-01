import { getStorageItem, setStorageItem } from './storage.js';

export function parseNaturalLanguageTask(text) {
  // Multi-task extraction: split combined inputs on "and", "then", "also", "plus"
  const textParts = splitMultiTasks(text);
  if (textParts.length === 0) return [];
  return textParts.map(part => parseSingleTask(part));
}

function splitMultiTasks(text) {
  if (!text) return [];
  // Split on boundaries of "and", "then", "also", "plus", or commas/semicolons
  return text.split(/\s*(?:\band\b|\bthen\b|\balso\b|\bplus\b|[,;])\s*/i).filter(p => p.trim().length > 0);
}

function parseSingleTask(text) {
  const now = new Date();
  
  // Preprocess
  const preprocessed = preprocessText(text);

  // Check for Water Command
  const waterMatch = preprocessed.match(/(?:log|drink)?\s*(\d+)\s*ml\s*(?:of)?\s*(?:water)?/i);
  if (waterMatch && preprocessed.toLowerCase().includes('water')) {
    return {
      action: 'water',
      amount: parseInt(waterMatch[1])
    };
  } else if (preprocessed.toLowerCase().includes('drink water') || preprocessed.toLowerCase().includes('log water') || preprocessed.toLowerCase().includes('remind me to drink water') || preprocessed.toLowerCase().includes('remind to drink water')) {
    return {
      action: 'water',
      amount: 250
    };
  }

  // Check for Expense Command
  const expenseMatch = preprocessed.match(/(?:log|spend|expense)\s*(?:a|an|the|my)?\s*(?:\$|₹|rs\.?)?\s*(\d+)\s*(?:on|for)?\s*(.*)/i);
  if (expenseMatch) {
    return {
      action: 'expense',
      amount: parseFloat(expenseMatch[1]),
      notes: expenseMatch[2] ? expenseMatch[2].trim() : 'Voice logged expense'
    };
  }

  // Check for Timer Command
  const timerMatch = preprocessed.match(/(?:set|start)?\s*(?:a)?\s*(\d+)\s*(?:minute|min|mins|hour|hr|hours)?\s*(?:study)?\s*(?:timer|pomodoro)/i);
  if (timerMatch) {
    let mins = parseInt(timerMatch[1]);
    const isHour = /hour|hr/i.test(timerMatch[0]);
    if (isHour) mins *= 60;
    return {
      action: 'timer',
      duration: mins
    };
  }
  
  // Pipeline for standard tasks:
  const { date, dateFound, textWithoutDate } = parseDate(preprocessed, now);
  const { startTime, endTime, timeFound, textWithoutTime } = parseTime(textWithoutDate, dateFound, now);
  const { recurring, recurrenceType, recurrenceDays, textWithoutRecurrence } = parseRecurrence(textWithoutTime);
  const category = inferCategory(textWithoutRecurrence);
  const priority = inferPriority(textWithoutRecurrence);
  const title = normalizeTitle(textWithoutRecurrence);
  
  return {
    title: title || "Quick Task",
    date: date,
    startTime: startTime,
    endTime: endTime,
    category: category,
    priority: priority,
    recurring: recurring,
    recurrenceType: recurrenceType,
    recurrenceDays: recurrenceDays
  };
}

// 1. Preprocess
function preprocessText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// 2. Date parsing (relative, day name, Hindi)
function parseDate(text, now) {
  const textLower = text.toLowerCase();
  let date = new Date(now);
  let dateFound = false;
  let textWithoutDate = text;
  
  // Hindi "kal" / Tomorrow
  if (/\b(kal|tomorrow)\b/i.test(textLower)) {
    date.setDate(now.getDate() + 1);
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(/\b(kal|tomorrow)\b/gi, '');
  }
  // Hindi "parso" / Day after tomorrow
  else if (/\b(parso|day after tomorrow)\b/i.test(textLower)) {
    date.setDate(now.getDate() + 2);
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(/\b(parso|day after tomorrow)\b/gi, '');
  }
  // Tonight
  else if (/\btonight\b/i.test(textLower)) {
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(/\btonight\b/gi, '');
  }
  // This evening
  else if (/\bthis evening\b/i.test(textLower)) {
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(/\bthis evening\b/gi, '');
  }
  // Next week
  else if (/\bnext week\b/i.test(textLower)) {
    date.setDate(now.getDate() + 7);
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(/\bnext week\b/gi, '');
  }
  // Next Friday/Monday etc.
  const nextDayRegex = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const nextMatch = textLower.match(nextDayRegex);
  if (nextMatch) {
    const targetDayName = nextMatch[1];
    const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const targetDayIndex = daysMap[targetDayName];
    const currentDayIndex = now.getDay();
    let diff = targetDayIndex - currentDayIndex;
    if (diff <= 0) diff += 7;
    // Add another week since it's "next" week's day
    diff += 7;
    date.setDate(now.getDate() + diff);
    dateFound = true;
    textWithoutDate = textWithoutDate.replace(nextDayRegex, '');
  }
  // Standard weekday mapping (mon, tue, etc.)
  else {
    const daysMap = {
      monday: 1, mon: 1, somvar: 1,
      tuesday: 2, tue: 2, mangalvar: 2,
      wednesday: 3, wed: 3, budhvar: 3,
      thursday: 4, thu: 4, veerwar: 4, guruvar: 4,
      friday: 5, fri: 5, shukravar: 5,
      saturday: 6, sat: 6, shanivar: 6,
      sunday: 0, sun: 0, ravivar: 0
    };
    for (const [dayName, dayIndex] of Object.entries(daysMap)) {
      const regex = new RegExp(`\\b${dayName}\\b`, "i");
      if (regex.test(textLower)) {
        const currentDayIndex = now.getDay();
        let diff = dayIndex - currentDayIndex;
        if (diff <= 0) diff += 7;
        date.setDate(now.getDate() + diff);
        dateFound = true;
        textWithoutDate = textWithoutDate.replace(regex, '');
        break;
      }
    }
  }

  // Format to YYYY-MM-DD
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  
  return {
    date: `${y}-${m}-${d}`,
    dateFound,
    textWithoutDate: textWithoutDate.trim()
  };
}

// 3. Time range and relative time parsing
function parseTime(text, dateFound, now) {
  const textLower = text.toLowerCase();
  let startTime = "";
  let endTime = "";
  let timeFound = false;
  let textWithoutTime = text;

  // Relative periods: in X hours
  const inHoursMatch = textLower.match(/\bin\s+(\d+)\s+hours?\b/i);
  if (inHoursMatch) {
    const hrs = parseInt(inHoursMatch[1]);
    const target = new Date(now.getTime() + hrs * 60 * 60 * 1000);
    const startH = target.getHours();
    const startM = target.getMinutes();
    startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
    timeFound = true;
    textWithoutTime = textWithoutTime.replace(inHoursMatch[0], '');
  }

  // Time range formats: "from 5 to 7", "3pm-4pm", "6:30 to 8", "between 2 and 4"
  const rangeRegexes = [
    // from 5 to 7 / 5:30 to 7:30 / 5 to 7 pm
    /(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|and)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    // between 2 and 4
    /between\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*and\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  ];

  let rangeMatched = false;
  for (const r of rangeRegexes) {
    const match = textLower.match(r);
    if (match) {
      let startH = parseInt(match[1]);
      let startM = match[2] ? parseInt(match[2]) : 0;
      let startMeridian = match[3];
      
      let endH = parseInt(match[4]);
      let endM = match[5] ? parseInt(match[5]) : 0;
      let endMeridian = match[6];
      
      // Guess PM for afternoon ranges
      if (!startMeridian && !endMeridian) {
        if (startH < 12 && startH >= 1 && endH < 12) {
          if (startH >= 1 && startH < 8) {
            startH += 12;
            endH += 12;
          }
        }
      } else {
        if (startMeridian === 'pm' && startH < 12) startH += 12;
        if (startMeridian === 'am' && startH === 12) startH = 0;
        
        if (endMeridian === 'pm' && endH < 12) endH += 12;
        if (endMeridian === 'am' && endH === 12) endH = 0;
        
        if (!startMeridian && endMeridian) {
          if (endMeridian === 'pm' && startH < 12) {
            if (startH < endH) startH += 12;
          }
        }
      }
      
      startTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
      endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
      timeFound = true;
      rangeMatched = true;
      textWithoutTime = textWithoutTime.replace(match[0], '');
      break;
    }
  }

  // Single time formats (English at 5, Hindi 5 baje)
  if (!rangeMatched) {
    const hindiTimeRegex = /(subah|shaam|dopahar|raat)?\s*(\d{1,2})(?::(\d{2}))?\s*(baje)/i;
    const englishTimeRegex = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(pm|am)?\b/i;
    
    let match = textLower.match(hindiTimeRegex);
    if (match) {
      let period = match[1];
      let hours = parseInt(match[2]);
      let minutes = match[3] ? parseInt(match[3]) : 0;
      
      if (period === 'shaam' || period === 'raat' || period === 'dopahar') {
        if (hours < 12) hours += 12;
      } else if (period === 'subah' && hours === 12) {
        hours = 0;
      } else if (!period) {
        if (hours >= 1 && hours < 8) hours += 12;
      }
      
      startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      timeFound = true;
      textWithoutTime = textWithoutTime.replace(match[0], '');
    } else {
      match = textLower.match(englishTimeRegex);
      if (match && !dateFound) {
        let hours = parseInt(match[1]);
        let minutes = match[2] ? parseInt(match[2]) : 0;
        let meridian = match[3];
        
        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;
        if (!meridian && hours >= 1 && hours < 8) hours += 12;
        
        if (hours >= 0 && hours <= 23) {
          startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          timeFound = true;
          textWithoutTime = textWithoutTime.replace(match[0], '');
        }
      }
    }
  }

  // Relative periods
  if (!timeFound) {
    const periods = {
      'before class': '08:00',
      'after lunch': '14:00',
      'tonight': '21:00',
      'this evening': '18:00',
      'morning': '08:00',
      'afternoon': '14:00',
      'evening': '18:00',
      'night': '21:00'
    };
    for (const [p, t] of Object.entries(periods)) {
      if (textLower.includes(p)) {
        startTime = t;
        timeFound = true;
        textWithoutTime = textWithoutTime.replace(new RegExp(`\\b${p}\\b`, 'gi'), '');
        break;
      }
    }
  }

  // Default duration of 1 hour if startTime is found but no range
  if (startTime && !endTime) {
    const [h, m] = startTime.split(':').map(Number);
    let endH = h + 1;
    if (endH >= 24) endH = 0;
    endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  return {
    startTime,
    endTime,
    timeFound,
    textWithoutTime: textWithoutTime.trim()
  };
}

// 4. Recurrence parsing
function parseRecurrence(text) {
  const textLower = text.toLowerCase();
  let recurring = false;
  let recurrenceType = "";
  let recurrenceDays = [];
  let textWithoutRecurrence = text;

  const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

  if (/\b(?:every\s+day|daily)\b/i.test(textLower)) {
    recurring = true;
    recurrenceType = "daily";
    textWithoutRecurrence = textWithoutRecurrence.replace(/\b(?:every\s+day|daily)\b/gi, '');
  } else if (/\bweekdays\b/i.test(textLower)) {
    recurring = true;
    recurrenceType = "weekly";
    recurrenceDays = [1, 2, 3, 4, 5];
    textWithoutRecurrence = textWithoutRecurrence.replace(/\bweekdays\b/gi, '');
  } else if (/\bweekends\b/i.test(textLower)) {
    recurring = true;
    recurrenceType = "weekly";
    recurrenceDays = [6, 0];
    textWithoutRecurrence = textWithoutRecurrence.replace(/\bweekends\b/gi, '');
  } else if (/\bmonthly\b/i.test(textLower)) {
    recurring = true;
    recurrenceType = "monthly";
    textWithoutRecurrence = textWithoutRecurrence.replace(/\bmonthly\b/gi, '');
  } else {
    const everyDayRegex = /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const match = textLower.match(everyDayRegex);
    if (match) {
      recurring = true;
      recurrenceType = "weekly";
      recurrenceDays = [daysMap[match[1]]];
      textWithoutRecurrence = textWithoutRecurrence.replace(everyDayRegex, '');
    } else if (/\bevery\s+week\b/i.test(textLower)) {
      recurring = true;
      recurrenceType = "weekly";
      textWithoutRecurrence = textWithoutRecurrence.replace(/\bevery\s+week\b/gi, '');
    }
  }

  return {
    recurring,
    recurrenceType,
    recurrenceDays,
    textWithoutRecurrence: textWithoutRecurrence.trim()
  };
}

// 5. Infer Category
function inferCategory(text) {
  const textLower = text.toLowerCase();
  const keywords = {
    health: ['gym', 'workout', 'run', 'exercise', 'water', 'yoga', 'hydrate', 'sport', 'meditation'],
    study: ['study', 'homework', 'class', 'exam', 'physics', 'math', 'science', 'lecture', 'school', 'college', 'read', 'revision', 'write'],
    work: ['work', 'meeting', 'call', 'office', 'code', 'coding', 'email', 'presentation', 'interview', 'project'],
    personal: ['mama', 'family', 'buy', 'grocery', 'cleaning', 'laundry', 'shop', 'watch', 'movie', 'dinner']
  };

  for (const [cat, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (textLower.includes(word)) {
        return cat;
      }
    }
  }
  return "personal";
}

// 6. Infer Priority
function inferPriority(text) {
  const textLower = text.toLowerCase();
  if (/\b(?:urgent|important|asap|high|emergency)\b/i.test(textLower)) {
    return "high";
  }
  if (/\b(?:low|relaxed|someday|leisure)\b/i.test(textLower)) {
    return "low";
  }
  return "medium";
}

// 7. Normalize title
function normalizeTitle(text) {
  if (!text) return "";
  
  const helperPhrases = [
    /remind me to/gi,
    /please remind/gi,
    /mujhe yaad dilana/gi,
    /jaana hai/gi,
    /karna hai/gi,
    /\b(?:at|on|to|for|in|with|about)\s*$/i
  ];

  let cleaned = text;
  helperPhrases.forEach(regex => {
    cleaned = cleaned.replace(regex, '');
  });

  cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) return "";

  const words = cleaned.split(' ');
  const lowercaseFillers = ['with', 'at', 'on', 'in', 'to', 'for', 'and', 'or', 'a', 'an', 'the', 'of', 'by', 'but', 'is', 'are'];
  
  const capitalizedWords = words.map((word, idx) => {
    const wordLower = word.toLowerCase();
    if (idx === 0 || !lowercaseFillers.includes(wordLower)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return wordLower;
  });

  return capitalizedWords.join(' ');
}
