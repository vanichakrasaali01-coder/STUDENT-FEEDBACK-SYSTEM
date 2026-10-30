const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString("hex");
const dbPath = path.join(__dirname, "feedback.db");
const db = new sqlite3.Database(dbPath);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (error) { error ? reject(error) : resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
});

async function initializeDatabase() {
  await run("PRAGMA foreign_keys = ON");
  await run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, code TEXT UNIQUE NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','faculty','student')),
    department_id INTEGER, year INTEGER, student_code TEXT UNIQUE,
    FOREIGN KEY(department_id) REFERENCES departments(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL, department_id INTEGER NOT NULL,
    FOREIGN KEY(department_id) REFERENCES departments(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, faculty_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
    UNIQUE(faculty_id, subject_id),
    FOREIGN KEY(faculty_id) REFERENCES users(id), FOREIGN KEY(subject_id) REFERENCES subjects(id)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, faculty_id INTEGER NOT NULL, subject_id INTEGER NOT NULL,
    period TEXT NOT NULL, teaching INTEGER NOT NULL, communication INTEGER NOT NULL, knowledge INTEGER NOT NULL,
    interaction INTEGER NOT NULL, punctuality INTEGER NOT NULL, doubts INTEGER NOT NULL, overall INTEGER NOT NULL,
    comments TEXT, anonymous INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, faculty_id, subject_id, period),
    FOREIGN KEY(student_id) REFERENCES users(id), FOREIGN KEY(faculty_id) REFERENCES users(id), FOREIGN KEY(subject_id) REFERENCES subjects(id)
  )`);

  const count = await get("SELECT COUNT(*) AS count FROM users");
  if (count.count === 0) {
    const password = await bcrypt.hash("password123", 10);
    await run("INSERT INTO departments (name, code) VALUES (?, ?), (?, ?), (?, ?)",
      ["Computer Science", "CSE", "Electronics & Communication", "ECE", "Mechanical Engineering", "ME"]);
    const cse = await get("SELECT id FROM departments WHERE code='CSE'");
    const ece = await get("SELECT id FROM departments WHERE code='ECE'");
    const me = await get("SELECT id FROM departments WHERE code='ME'");
    await run("INSERT INTO users (name,email,password,role,department_id) VALUES (?,?,?,?,?)", ["Admin User", "admin@college.edu", password, "admin", null]);
    await run("INSERT INTO users (name,email,password,role,department_id) VALUES (?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?)",
      ["Dr. Ananya Rao", "ananya@college.edu", password, "faculty", cse.id,
       "Prof. Vikram Singh", "vikram@college.edu", password, "faculty", ece.id,
       "Dr. Meera Patel", "meera@college.edu", password, "faculty", me.id]);
    await run("INSERT INTO users (name,email,password,role,department_id,year,student_code) VALUES (?,?,?,?,?,?,?)",
      ["Aarav Sharma", "aarav@college.edu", password, "student", cse.id, 3, "CSE2023001"]);
    await run("INSERT INTO subjects (name,code,department_id) VALUES (?,?,?),(?,?,?),(?,?,?),(?,?,?),(?,?,?)",
      ["Data Structures", "CS301", cse.id, "Database Systems", "CS302", cse.id,
       "Digital Electronics", "EC201", ece.id, "Machine Design", "ME301", me.id,
       "Computer Networks", "CS303", cse.id]);
    const faculty = await get("SELECT id FROM users WHERE email='ananya@college.edu'");
    const subjects = await all("SELECT id FROM subjects ORDER BY id");
    for (const subject of subjects.slice(0, 3)) await run("INSERT OR IGNORE INTO assignments (faculty_id,subject_id) VALUES (?,?)", [faculty.id, subject.id]);
    const faculty2 = await get("SELECT id FROM users WHERE email='vikram@college.edu'");
    await run("INSERT OR IGNORE INTO assignments (faculty_id,subject_id) VALUES (?,?)", [faculty2.id, subjects[2].id]);
    const faculty3 = await get("SELECT id FROM users WHERE email='meera@college.edu'");
    await run("INSERT OR IGNORE INTO assignments (faculty_id,subject_id) VALUES (?,?)", [faculty3.id, subjects[3].id]);
    const student = await get("SELECT id FROM users WHERE email='aarav@college.edu'");
    await run(`INSERT OR IGNORE INTO feedback
      (student_id,faculty_id,subject_id,period,teaching,communication,knowledge,interaction,punctuality,doubts,overall,comments,anonymous)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [student.id, faculty.id, subjects[0].id, "2026-27 Semester 1", 5, 4, 5, 5, 4, 5, 5,
       "The examples and projects made difficult concepts easy to understand.", 0]);
  }

  const cse = await get("SELECT id FROM departments WHERE code='CSE'");
  const password = await bcrypt.hash("password123", 10);
  await run("INSERT OR IGNORE INTO users (name,email,password,role,department_id) VALUES (?,?,?,?,?)",
    ["Prof. Arjun Nair", "arjun@college.edu", password, "faculty", cse.id]);
  await run("INSERT OR IGNORE INTO users (name,email,password,role,department_id) VALUES (?,?,?,?,?)",
    ["Dr. Kavya Reddy", "kavya@college.edu", password, "faculty", cse.id]);

  const cseSubjects = [
    ["Data Structures", "CS301"], ["Database Systems", "CS302"], ["Computer Networks", "CS303"],
    ["Operating Systems", "CS304"], ["Object Oriented Programming", "CS305"],
    ["Artificial Intelligence", "CS306"], ["Web Technologies", "CS307"],
    ["Software Engineering", "CS308"], ["Machine Learning", "CS309"],
    ["Cloud Computing", "CS310"], ["Cryptography and Network Security", "CS311"],
    ["Mobile Application Development", "CS312"]
  ];
  for (const [name, code] of cseSubjects) {
    await run("INSERT OR IGNORE INTO subjects (name, code, department_id) VALUES (?,?,?)", [name, code, cse.id]);
  }
  const ananya = await get("SELECT id FROM users WHERE email='ananya@college.edu'");
  const arjun = await get("SELECT id FROM users WHERE email='arjun@college.edu'");
  const kavya = await get("SELECT id FROM users WHERE email='kavya@college.edu'");
  const assignments = [
    [ananya.id, "CS301"], [ananya.id, "CS302"], [ananya.id, "CS303"],
    [arjun.id, "CS304"], [arjun.id, "CS305"], [arjun.id, "CS308"],
    [kavya.id, "CS306"], [kavya.id, "CS307"], [kavya.id, "CS309"],
    [kavya.id, "CS310"], [kavya.id, "CS311"], [arjun.id, "CS312"]
  ];
  for (const [facultyId, code] of assignments) {
    const subject = await get("SELECT id FROM subjects WHERE code=?", [code]);
    if (subject) await run("INSERT OR IGNORE INTO assignments (faculty_id, subject_id) VALUES (?,?)", [facultyId, subject.id]);
  }
}

function authenticate(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid or expired session" }); }
}
function authorize(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Access denied" });
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: "Email, password and role are required" });
    const user = await get(`SELECT users.*, departments.name AS department FROM users
      LEFT JOIN departments ON departments.id=users.department_id WHERE users.email=? AND users.role=?`, [email.trim().toLowerCase(), role]);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid credentials or role" });
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, year: user.year, studentCode: user.student_code } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get("/api/student/dashboard", authenticate, authorize("student"), async (req, res) => {
  const profile = await get(`SELECT u.*, d.name department FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.id=?`, [req.user.id]);
  const subjects = await all(`SELECT DISTINCT s.id,s.name,s.code,u.id facultyId,u.name faculty
    FROM assignments a JOIN subjects s ON s.id=a.subject_id JOIN users u ON u.id=a.faculty_id
    WHERE s.department_id=?`, [profile.department_id]);
  const submitted = await all("SELECT subject_id, faculty_id FROM feedback WHERE student_id=? AND period='2026-27 Semester 1'", [req.user.id]);
  const key = new Set(submitted.map(x => `${x.subject_id}-${x.faculty_id}`));
  res.json({ profile: { name: profile.name, studentCode: profile.student_code, department: profile.department, year: profile.year },
    subjects: subjects.map(x => ({ ...x, submitted: key.has(`${x.id}-${x.facultyId}`) })) });
});

app.post("/api/student/feedback", authenticate, authorize("student"), async (req, res) => {
  const b = req.body;
  const ratings = ["teaching","communication","knowledge","interaction","punctuality","doubts","overall"];
  if (!b.facultyId || !b.subjectId || ratings.some(k => !Number.isInteger(Number(b[k])) || b[k] < 1 || b[k] > 5))
    return res.status(400).json({ error: "Select a faculty, subject and a rating from 1 to 5 for every criterion." });
  const assignment = await get("SELECT 1 FROM assignments WHERE faculty_id=? AND subject_id=?", [b.facultyId, b.subjectId]);
  if (!assignment) return res.status(400).json({ error: "Faculty is not assigned to this subject" });
  try {
    await run(`INSERT INTO feedback (student_id,faculty_id,subject_id,period,teaching,communication,knowledge,interaction,punctuality,doubts,overall,comments,anonymous)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id,b.facultyId,b.subjectId,"2026-27 Semester 1",b.teaching,b.communication,b.knowledge,b.interaction,b.punctuality,b.doubts,b.overall,(b.comments || "").trim(),b.anonymous ? 1 : 0]);
    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "Feedback for this faculty and subject has already been submitted for this period." });
    res.status(500).json({ error: "Could not submit feedback" });
  }
});

app.get("/api/faculty/dashboard", authenticate, authorize("faculty"), async (req, res) => {
  const rows = await all(`SELECT f.*, u.name studentName, u.student_code, s.name subjectName, s.code subjectCode
    FROM feedback f JOIN users u ON u.id=f.student_id JOIN subjects s ON s.id=f.subject_id WHERE f.faculty_id=? ORDER BY f.created_at DESC`, [req.user.id]);
  const visible = rows.map(r => ({ ...r, studentName: r.anonymous ? "Anonymous Student" : r.studentName, student_code: r.anonymous ? null : r.student_code }));
  const averages = await get(`SELECT ROUND(AVG((teaching+communication+knowledge+interaction+punctuality+doubts+overall)/7),1) score,
    COUNT(*) submissions FROM feedback WHERE faculty_id=?`, [req.user.id]);
  const subjects = await all(`SELECT s.name,ROUND(AVG((f.teaching+f.communication+f.knowledge+f.interaction+f.punctuality+f.doubts+f.overall)/7),1) score,COUNT(*) submissions
    FROM feedback f JOIN subjects s ON s.id=f.subject_id WHERE f.faculty_id=? GROUP BY s.id,s.name`, [req.user.id]);
  res.json({ submissions: visible, score: averages.score || 0, count: averages.submissions || 0, subjectRatings: subjects });
});

app.get("/api/admin/dashboard", authenticate, authorize("admin"), async (req, res) => {
  const [students, faculty, feedback, departments, subjects] = await Promise.all([
    get("SELECT COUNT(*) count FROM users WHERE role='student'"),
    get("SELECT COUNT(*) count FROM users WHERE role='faculty'"),
    get("SELECT COUNT(*) count FROM feedback"),
    all(`SELECT d.id,d.name,d.code,COUNT(DISTINCT u.id) students,
      (SELECT COUNT(*) FROM feedback f JOIN subjects s ON s.id=f.subject_id WHERE s.department_id=d.id) submissions
      FROM departments d LEFT JOIN users u ON u.department_id=d.id AND u.role='student' GROUP BY d.id`),
    all("SELECT COUNT(*) count FROM subjects")
  ]);
  const users = await all(`SELECT u.id,u.name,u.email,u.role,u.year,u.student_code,d.name department,d.id departmentId
    FROM users u LEFT JOIN departments d ON d.id=u.department_id WHERE u.role!='admin' ORDER BY u.role,u.name`);
  const subjectRows = await all(`SELECT s.id,s.name,s.code,d.name department FROM subjects s JOIN departments d ON d.id=s.department_id ORDER BY s.name`);
  const assignments = await all(`SELECT a.id,u.name faculty,s.name subject FROM assignments a JOIN users u ON u.id=a.faculty_id JOIN subjects s ON s.id=a.subject_id`);
  res.json({ stats:{students:students.count,faculty:faculty.count,feedback:feedback.count,departments:departments.length,subjects:subjects.count},
    departmentFeedback:departments,users,subjectRows,assignments });
});

app.get("/api/admin/departments", authenticate, authorize("admin"), async (req,res) => res.json(await all("SELECT * FROM departments ORDER BY name")));

app.post("/api/admin/users", authenticate, authorize("admin"), async (req,res) => {
  const {name,email,password,role,departmentId,year,studentCode} = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error:"Name, email, password and role are required" });
  try {
    const hash = await bcrypt.hash(password,10);
    await run(`INSERT INTO users (name,email,password,role,department_id,year,student_code) VALUES (?,?,?,?,?,?,?)`,
      [name,email.toLowerCase(),hash,role,departmentId || null,year || null,studentCode || null]);
    res.status(201).json({message:"User created"});
  } catch(error) { res.status(409).json({error:error.message.includes("UNIQUE") ? "Email or student ID already exists" : error.message}); }
});

app.put("/api/admin/users/:id", authenticate, authorize("admin"), async (req,res) => {
  const {name,email,role,departmentId,year,studentCode,password} = req.body;
  if (!name || !email || !role) return res.status(400).json({error:"Name, email and role are required"});
  try {
    if (password) await run("UPDATE users SET name=?,email=?,role=?,department_id=?,year=?,student_code=?,password=? WHERE id=?",
      [name,email.toLowerCase(),role,departmentId || null,year || null,studentCode || null,await bcrypt.hash(password,10),req.params.id]);
    else await run("UPDATE users SET name=?,email=?,role=?,department_id=?,year=?,student_code=? WHERE id=?",
      [name,email.toLowerCase(),role,departmentId || null,year || null,studentCode || null,req.params.id]);
    res.json({message:"User updated"});
  } catch(error) { res.status(409).json({error:"Email or student ID already exists"}); }
});

app.delete("/api/admin/users/:id", authenticate, authorize("admin"), async (req,res) => {
  await run("DELETE FROM feedback WHERE student_id=? OR faculty_id=?", [req.params.id,req.params.id]);
  await run("DELETE FROM assignments WHERE faculty_id=?", [req.params.id]);
  await run("DELETE FROM users WHERE id=?", [req.params.id]);
  res.json({message:"User deleted"});
});

app.post("/api/admin/subjects", authenticate, authorize("admin"), async (req,res) => {
  const {name,code,departmentId} = req.body;
  if (!name || !code || !departmentId) return res.status(400).json({error:"Subject name, code and department are required"});
  try { await run("INSERT INTO subjects (name,code,department_id) VALUES (?,?,?)",[name,code.toUpperCase(),departmentId]); res.status(201).json({message:"Subject created"}); }
  catch(error) { res.status(409).json({error:"Subject code already exists"}); }
});

app.post("/api/admin/assignments", authenticate, authorize("admin"), async (req,res) => {
  const {facultyId,subjectId} = req.body;
  if (!facultyId || !subjectId) return res.status(400).json({error:"Faculty and subject are required"});
  try { await run("INSERT INTO assignments (faculty_id,subject_id) VALUES (?,?)",[facultyId,subjectId]); res.status(201).json({message:"Faculty assigned"}); }
  catch(error) { res.status(409).json({error:"This assignment already exists"}); }
});

app.delete("/api/admin/assignments/:id", authenticate, authorize("admin"), async (req,res) => {
  await run("DELETE FROM assignments WHERE id=?", [req.params.id]); res.json({message:"Assignment removed"});
});

app.get("/api/reports/all", authenticate, authorize("admin"), async (req,res) => res.json(await all(`SELECT f.*,u.name studentName,u.student_code,s.name subjectName,d.name department,fu.name facultyName
  FROM feedback f JOIN users u ON u.id=f.student_id JOIN subjects s ON s.id=f.subject_id
  JOIN users fu ON fu.id=f.faculty_id JOIN departments d ON d.id=s.department_id`)));

app.get("/api/reports/export/:format", authenticate, authorize("admin"), async (req,res) => {
  const rows = await all(`SELECT CASE WHEN f.anonymous=1 THEN 'Anonymous Student' ELSE u.name END student,
    CASE WHEN f.anonymous=1 THEN 'Anonymous' ELSE d.name END department,
    s.name subject,fu.name faculty,ROUND((f.teaching+f.communication+f.knowledge+f.interaction+f.punctuality+f.doubts+f.overall)/7,2) score,
    f.teaching,f.communication,f.knowledge,f.interaction,f.punctuality,f.doubts,f.overall,f.comments,f.period
    FROM feedback f JOIN users u ON u.id=f.student_id JOIN subjects s ON s.id=f.subject_id JOIN users fu ON fu.id=f.faculty_id
    JOIN departments d ON d.id=s.department_id`);
  if (req.params.format === "excel") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.map(r => ({...r, student:r.anonymous ? "Anonymous" : r.student}))), "Feedback");
    const buffer = XLSX.write(workbook,{type:"buffer",bookType:"xlsx"});
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition",'attachment; filename="feedback-report.xlsx"');
    return res.send(buffer);
  }
  if (req.params.format === "pdf") {
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",'attachment; filename="feedback-report.pdf"');
    const doc = new PDFDocument({margin:40}); doc.pipe(res);
    doc.fontSize(18).text("Student Feedback Report",{align:"center"}).moveDown();
    rows.forEach((r,i) => doc.fontSize(10).text(`${i+1}. ${r.subject} | ${r.faculty} | Score: ${r.score}/5 | ${r.comments || "No comments"}`).moveDown(0.5));
    return doc.end();
  }
  res.status(400).json({error:"Use pdf or excel format"});
});

app.get("/api/analytics", authenticate, async (req,res) => {
  const faculty = await all(`SELECT u.name,ROUND(AVG((f.teaching+f.communication+f.knowledge+f.interaction+f.punctuality+f.doubts+f.overall)/7),2) score
    FROM feedback f JOIN users u ON u.id=f.faculty_id GROUP BY u.id,u.name`);
  const departments = await all(`SELECT d.name,ROUND(AVG((f.teaching+f.communication+f.knowledge+f.interaction+f.punctuality+f.doubts+f.overall)/7),2) score
    FROM feedback f JOIN subjects s ON s.id=f.subject_id JOIN departments d ON d.id=s.department_id GROUP BY d.id,d.name`);
  const subjects = await all(`SELECT s.name,ROUND(AVG((f.teaching+f.communication+f.knowledge+f.interaction+f.punctuality+f.doubts+f.overall)/7),2) score
    FROM feedback f JOIN subjects s ON s.id=f.subject_id GROUP BY s.id,s.name`);
  const summary = await get(`SELECT ROUND(AVG((teaching+communication+knowledge+interaction+punctuality+doubts+overall)/7)/5*100,1) satisfaction,
    SUM(CASE WHEN overall>=4 THEN 1 ELSE 0 END) positive,SUM(CASE WHEN overall<=2 THEN 1 ELSE 0 END) negative,COUNT(*) total FROM feedback`);
  res.json({faculty,departments,subjects,summary});
});

app.use((req,res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({error:"API endpoint not found"});
  res.sendFile(path.join(__dirname,"public","index.html"));
});

initializeDatabase().then(() => {
  app.listen(PORT, () => console.log(`Student Feedback System running at http://localhost:${PORT}`));
}).catch(error => { console.error("Database initialization failed:", error); process.exit(1); });
