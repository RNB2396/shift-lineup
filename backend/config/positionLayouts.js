// Position layouts for each shift period based on number of people working
// Each position can have a "/" indicating combined roles

const positionLayouts = {
  morning: {
    // 6:00 AM - 10:30 AM
    startTime: "06:00",
    endTime: "10:30",
    layouts: {
      4: ["fileter", "breader", "secondary1", "hashbrowns/griddle"],
      5: ["primary", "secondary1", "hashbrowns/griddle", "breader", "breaks"],
      6: ["primary", "secondary1", "secondary2", "hashbrowns/griddle", "breader", "breaks"],
      7: ["primary", "secondary1", "secondary2", "hashbrowns", "griddle", "breader", "breaks"],
      8: ["primary", "primary2", "secondary1", "secondary2", "hashbrowns", "griddle", "breader", "breaks"]
    }
  },
  lunch: {
    // 10:30 AM - 2:00 PM
    startTime: "10:30",
    endTime: "14:00",
    layouts: {
      5: ["primary", "secondary1", "breading", "machines", "DT fries"],
      6: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries"],
      7: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries", "buns"],
      8: ["primary", "secondary1", "secondary2", "breading", "machines", "buns", "DT fries", "FC fries"]
    }
  },
  midday: {
    // 2:00 PM - 5:00 PM
    startTime: "14:00",
    endTime: "17:00",
    layouts: {
      4: ["primary", "secondary1", "breading", "machines"],
      5: ["primary", "secondary1", "breading", "machines", "DT fries"],
      6: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries"],
      7: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries", "buns"],
      8: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries", "buns", "FC fries"]
    }
  },
  dinner: {
    // 5:00 PM - 8:00 PM
    startTime: "17:00",
    endTime: "20:00",
    layouts: {
      5: ["primary", "secondary1", "secondary2", "breading", "machines"],
      6: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries"],
      7: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries", "buns"],
      8: ["primary", "secondary1", "secondary2", "breading", "machines", "DT fries", "buns", "FC fries"]
    }
  },
  lateNight: {
    // 8:00 PM - 10:00 PM
    startTime: "20:00",
    endTime: "22:00",
    layouts: {
      5: ["primary", "secondary1", "breading", "machines", "precloser/breaks"],
      6: ["primary", "secondary1", "breading", "machines", "precloser/breaks", "secondary2"],
      7: ["primary", "secondary1", "breading", "machines", "precloser/breaks", "precloser/breaks", "secondary2"]
    }
  }
};

// All unique positions across all shifts (for employee skill assignment)
// Note: "lead" is now assigned per-shift, not as a skill
const allPositions = [
  "primary",
  "secondary1",
  "secondary2",
  "breading",
  "machines",
  "DT fries",
  "FC fries",
  "buns"
];

// Helper function to get the shift period based on time
function getShiftPeriod(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;

  if (timeInMinutes >= 360 && timeInMinutes < 630) return 'morning';      // 6:00 - 10:30
  if (timeInMinutes >= 630 && timeInMinutes < 840) return 'lunch';        // 10:30 - 14:00
  if (timeInMinutes >= 840 && timeInMinutes < 1020) return 'midday';      // 14:00 - 17:00
  if (timeInMinutes >= 1020 && timeInMinutes < 1200) return 'dinner';     // 17:00 - 20:00
  if (timeInMinutes >= 1200 && timeInMinutes < 1320) return 'lateNight';  // 20:00 - 22:00

  return null;
}

// Helper function to get layout for a given period and count
function getLayout(period, peopleCount) {
  const periodData = positionLayouts[period];
  if (!periodData) return null;

  // Find the closest layout that doesn't exceed our people count
  const availableCounts = Object.keys(periodData.layouts).map(Number).sort((a, b) => a - b);

  // Find the largest layout that fits our people count
  let selectedCount = availableCounts[0];
  for (const count of availableCounts) {
    if (count <= peopleCount) {
      selectedCount = count;
    }
  }

  return {
    positions: periodData.layouts[selectedCount],
    usedCount: selectedCount,
    extraPeople: peopleCount - selectedCount
  };
}

module.exports = {
  positionLayouts,
  allPositions,
  getShiftPeriod,
  getLayout
};
