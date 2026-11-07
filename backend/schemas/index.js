const { z } = require("zod");
const { TASK_STATUSES } = require("../utils/constants");

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const trimmed = (min, max, label) =>
  z.string({ error: `${label} is required` }).trim().min(min, `${label} is required`).max(max, `${label} is too long`);

const mediaItem = z.object({
  mediaType: z.string().max(200).optional(),
  mediaURL: z
    .string()
    .url()
    .max(2048)
    .refine((u) => u.startsWith("https://"), "Media URL must use https"),
  mediaName: z.string().max(300).optional(),
  mediaSize: z.number().nonnegative().optional(),
});

const idParam = (name) => z.object({ [name]: objectId });

// ---- auth
const register = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, numbers, . _ -"),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
  firstName: trimmed(1, 60, "First name"),
  lastName: trimmed(1, 60, "Last name"),
  role: trimmed(1, 60, "Role"),
  dateOfBirth: trimmed(1, 40, "Date of birth"),
});
const login = z.object({
  username: z.string().trim().min(1, "Username is required").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

// ---- users
const updateProfile = z.object({
  firstName: trimmed(1, 60, "First name"),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().trim().toLowerCase().email().max(254),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Username may contain letters, numbers, . _ -"),
  dateOfBirth: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(500).optional(),
});
const userSearch = z.object({ q: z.string().trim().max(60).optional() });

// ---- projects
const createProject = z.object({
  projectName: trimmed(1, 100, "Project name"),
  projectDescription: z.string().trim().max(2000).optional().default(""),
});
const editProject = z.object({
  projectName: trimmed(1, 100, "Project name"),
  projectDescription: z.string().trim().max(2000).optional().default(""),
  projectStatus: z.enum(["In Progress", "Completed"]),
});
const memberBody = z.object({ memberId: objectId });
const addTask = z.object({
  taskTitle: trimmed(1, 200, "Task title"),
  taskDescription: z.string().trim().max(5000).optional().default(""),
  taskPriority: z.enum(["High", "Medium", "Low"]).optional().default("Medium"),
  dueDate: z.string().trim().max(60).optional(),
  assignedTo: objectId,
});

// ---- tasks
const editTask = z.object({
  taskTitle: trimmed(1, 200, "Task title"),
  taskDescription: z.string().trim().max(5000).optional().default(""),
  taskPriority: z.enum(["High", "Medium", "Low"]),
  taskStatus: z.enum(TASK_STATUSES),
  dueDate: z.string().trim().max(60).optional(),
});
const changeStatus = z.object({ newStatus: z.enum(TASK_STATUSES) });

// ---- activity feed
const activityQuery = z.object({
  before: objectId.optional(),
  category: z.enum(["project", "task", "comment", "file", "member"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ---- notifications
const notificationQuery = z.object({
  before: objectId.optional(),
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ---- shared
const comment = z.object({ messageContent: trimmed(1, 2000, "Comment") });
const addMedia = z.object({ mediaDataArray: z.array(mediaItem).min(1).max(20) });
const removeMedia = z.object({ mediaURL: z.string().url().max(2048) });

module.exports = {
  idParam, register, login, updateProfile, userSearch,
  createProject, editProject, memberBody, addTask,
  editTask, changeStatus, comment, addMedia, removeMedia, activityQuery, notificationQuery,
};
