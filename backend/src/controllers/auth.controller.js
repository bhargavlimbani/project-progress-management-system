const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // Try staff users first (admin, faculty, mentor)
    let userData = null;
    let isStudent = false;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        faculty: { include: { subjects: { include: { subject: true } } } },
        mentor: { include: { domains: { include: { domain: true } } } },
        admin: true,
      },
    });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({ message: "Your account has been deactivated." });
      }
      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) return res.status(401).json({ message: "Invalid credentials." });
      userData = user;
    } else {
      // Try student login
      const student = await prisma.student.findUnique({
        where: { email },
        include: { academicYear: true, semester: true },
      });
      if (!student) return res.status(401).json({ message: "Invalid credentials." });
      if (!student.isActive) {
        return res.status(403).json({ message: "Your account has been deactivated." });
      }
      if (!student.passwordHash) {
        return res.status(403).json({ message: "Account not activated. Check your email for activation link." });
      }
      const matches = await bcrypt.compare(password, student.passwordHash);
      if (!matches) return res.status(401).json({ message: "Invalid credentials." });
      isStudent = true;
      userData = student;
    }

    const tokenPayload = isStudent
      ? {
          id: userData.id,
          email: userData.email,
          role: "STUDENT",
          name: userData.name,
          enrollmentNumber: userData.enrollmentNumber,
        }
      : {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          name: userData.name,
        };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "8h",
    });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    // Build profile object
    let profile = null;
    if (isStudent) {
      profile = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: "STUDENT",
        enrollmentNumber: userData.enrollmentNumber,
        semester: userData.semester?.number,
        academicYear: userData.academicYear?.label,
        profilePhoto: userData.profilePhoto,
      };
    } else {
      profile = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        profilePhoto: userData.profilePhoto,
        ...(userData.faculty && { facultyId: userData.faculty.facultyId }),
        ...(userData.mentor && { mentorId: userData.mentor.mentorId }),
      };
    }

    // Log activity
    if (!isStudent) {
      await logActivity({
        userId: userData.id,
        action: "LOGIN",
        entityType: "User",
        entityId: userData.id,
      });
    }

    res.json({ accessToken, refreshToken, user: profile });
  } catch (err) {
    next(err);
  }
}

async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: "Refresh token required." });

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Re-check the account against the database. A refresh token stays
    // cryptographically valid for 7 days, so without this a deactivated or
    // deleted account could keep minting fresh access tokens.
    const stillActive =
      payload.role === "STUDENT"
        ? await prisma.student.findUnique({ where: { id: payload.id }, select: { isActive: true } })
        : await prisma.user.findUnique({ where: { id: payload.id }, select: { isActive: true } });

    if (!stillActive) {
      return res.status(401).json({ message: "Account no longer exists." });
    }
    if (!stillActive.isActive) {
      return res.status(403).json({ message: "Your account has been deactivated." });
    }

    // Remove iat/exp before re-signing
    const { iat, exp, ...tokenData } = payload;
    const newAccessToken = jwt.sign(tokenData, process.env.JWT_ACCESS_SECRET, { expiresIn: "8h" });
    res.json({ accessToken: newAccessToken });
  } catch {
    return res.status(401).json({ message: "Invalid refresh token." });
  }
}

async function getMe(req, res, next) {
  try {
    const { id, role } = req.user;
    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { id },
        include: { academicYear: true, semester: true },
      });
      if (!student) return res.status(404).json({ message: "Student not found." });
      return res.json({
        id: student.id,
        name: student.name,
        email: student.email,
        role: "STUDENT",
        mobile: student.mobile,
        enrollmentNumber: student.enrollmentNumber,
        profilePhoto: student.profilePhoto,
        semester: student.semester?.number,
        academicYear: student.academicYear?.label,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        faculty: { include: { subjects: { include: { subject: true } } } },
        mentor: { include: { domains: { include: { domain: true } } } },
      },
    });
    if (!user) return res.status(404).json({ message: "User not found." });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
      ...(user.faculty && { faculty: user.faculty }),
      ...(user.mentor && { mentor: user.mentor }),
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id, role } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters." });
    }

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { id } });
      if (!student) return res.status(404).json({ message: "Student not found." });
      const matches = await bcrypt.compare(currentPassword, student.passwordHash);
      if (!matches) return res.status(400).json({ message: "Current password is incorrect." });
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.student.update({ where: { id }, data: { passwordHash: hash } });
    } else {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ message: "User not found." });
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) return res.status(400).json({ message: "Current password is incorrect." });
      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
    }

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refreshToken, getMe, changePassword };
