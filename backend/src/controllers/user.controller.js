const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { parsePagination, paginated, parseSort } = require("../utils/pagination");
const { uploadFile } = require("../services/storage.service");
const { logActivity } = require("../services/activityLog.service");
const { VISIBLE_USER } = require("../utils/visibility");

const SAFE_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  profilePhoto: true,
  createdAt: true,
};

/** Staff directory (admin/faculty/mentor accounts). Admin only. */
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { role, isActive, search } = req.query;

  // Owner/break-glass accounts never appear in the directory.
  const where = { ...VISIBLE_USER };
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === "true";
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...SAFE_USER,
        faculty: { select: { facultyId: true, designation: true } },
        mentor: { select: { mentorId: true, expertise: true } },
      },
      orderBy: parseSort(req.query, ["name", "email", "createdAt"], { name: "asc" }),
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  res.json(paginated(users, total, { page, limit }));
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id, ...VISIBLE_USER },
    select: {
      ...SAFE_USER,
      faculty: { include: { subjects: { include: { subject: true } } } },
      mentor: { include: { domains: { include: { domain: true } } } },
    },
  });
  if (!user) throw ApiError.notFound("User not found.");
  res.json(user);
});

/** Activate or deactivate a staff account. */
const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (req.params.id === req.user.id) {
    throw ApiError.badRequest("You cannot deactivate your own account.");
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: Boolean(isActive) },
    select: SAFE_USER,
  });

  await logActivity({
    userId: req.user.id,
    action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "User",
    entityId: user.id,
  });

  res.json(user);
});

/**
 * Update the signed-in user's own profile. Role and active flag are
 * deliberately not editable here — those are admin operations.
 */
const updateOwnProfile = asyncHandler(async (req, res) => {
  const { name, mobile, expertise, designation } = req.body;
  const { id, role } = req.user;

  if (role === "STUDENT") {
    const student = await prisma.student.update({
      where: { id },
      data: { ...(name && { name }), ...(mobile && { mobile }) },
    });
    const { passwordHash, activationToken, ...safe } = student;
    return res.json(safe);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { ...(name && { name }) },
    select: SAFE_USER,
  });

  if (role === "FACULTY" && (mobile || designation)) {
    await prisma.faculty.update({
      where: { userId: id },
      data: { ...(mobile && { mobile }), ...(designation && { designation }) },
    });
  }
  if (role === "MENTOR" && (mobile || expertise)) {
    await prisma.mentor.update({
      where: { userId: id },
      data: { ...(mobile && { mobile }), ...(expertise && { expertise }) },
    });
  }

  res.json(user);
});

/** Upload/replace the signed-in user's avatar. */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image uploaded.");
  if (!req.file.mimetype.startsWith("image/")) {
    throw ApiError.badRequest("Profile photo must be an image.");
  }

  const stored = await uploadFile(req.file, "avatars");
  const { id, role } = req.user;

  if (role === "STUDENT") {
    await prisma.student.update({ where: { id }, data: { profilePhoto: stored.fileUrl } });
  } else {
    await prisma.user.update({ where: { id }, data: { profilePhoto: stored.fileUrl } });
  }

  res.json({ profilePhoto: stored.fileUrl });
});

/** Admin-initiated password reset for a staff account. */
const resetUserPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    throw ApiError.badRequest("Password must be at least 8 characters.");
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: hash } });

  await logActivity({
    userId: req.user.id,
    action: "PASSWORD_RESET",
    entityType: "User",
    entityId: req.params.id,
  });

  res.json({ message: "Password reset successfully." });
});

module.exports = {
  listUsers,
  getUserById,
  setUserActive,
  updateOwnProfile,
  uploadAvatar,
  resetUserPassword,
};
