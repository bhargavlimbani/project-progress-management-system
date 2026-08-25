const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  submitProjectIdea, reviewProjectIdea,
  getMentorRecommendation, assignMentor,
  getStudentProjects,
} = require("../controllers/project.controller");

const router = express.Router();
router.use(authenticate);

// General project routes
router.get("/", getProjects);
router.get("/my-projects", authorize("STUDENT"), getStudentProjects);
router.get("/:id", getProjectById);
router.post("/", createProject);
router.put("/:id", updateProject);
router.delete("/:id", authorize("ADMIN"), deleteProject);

// Project idea workflow
router.post("/:projectId/idea", authorize("STUDENT"), submitProjectIdea);
router.post("/:projectId/idea/review", authorize("FACULTY", "ADMIN"), reviewProjectIdea);

// Mentor recommendation and assignment
router.get("/:projectId/mentor-recommendation", authorize("FACULTY", "ADMIN"), getMentorRecommendation);
router.post("/:projectId/assign-mentor", authorize("FACULTY", "ADMIN"), assignMentor);

module.exports = router;
