const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { logActivity } = require("../services/activityLog.service");

// Default system configurations
const DEFAULT_SETTINGS = {
  ATTENDANCE_ENABLED: "false",
  MIN_ATTENDANCE_FOR_IDEA: "0",
  ALLOW_STUDENT_TEAM_CREATION: "true",
  NOTIFY_ON_IDEA_SUBMISSION: "true",
};

const getSettings = asyncHandler(async (req, res) => {
  const dbSettings = await prisma.systemSetting.findMany();
  const settingsMap = { ...DEFAULT_SETTINGS };

  for (const s of dbSettings) {
    settingsMap[s.key] = s.value;
  }

  res.json(settingsMap);
});

const updateSettings = asyncHandler(async (req, res) => {
  const updates = req.body; // e.g. { ATTENDANCE_ENABLED: "true", MIN_ATTENDANCE_FOR_IDEA: "75" }

  const results = {};
  for (const [key, value] of Object.entries(updates)) {
    const record = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
    results[record.key] = record.value;
  }

  await logActivity({
    userId: req.user.id,
    action: "SYSTEM_SETTINGS_UPDATED",
    entityType: "SystemSetting",
    metadata: updates,
  });

  res.json({ message: "Settings updated successfully.", settings: results });
});

module.exports = {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS,
};
