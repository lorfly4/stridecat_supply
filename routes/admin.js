const express = require("express")
const bcrypt = require("bcrypt")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const router = express.Router() // Use router instead of app

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "public/uploads/users/"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, "user-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"))
    }
  },
})

// Temporary in-memory storage (replace with your database)
const users = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    role: "admin",
    phone: "081234567890",
    address: "Jakarta",
    foto: null,
    created_at: new Date(),
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    role: "user",
    phone: "081234567891",
    address: "Bandung",
    foto: null,
    created_at: new Date(),
  },
]

let nextId = 3

// GET route for users page
router.get("/users", async (req, res) => {
  try {
    console.log("GET /admin/users - Loading users page")

    let message = null
    if (req.query.message && req.query.type) {
      message = {
        type: req.query.type,
        text: req.query.message,
      }
    }

    res.render("users", {
      users: req.session?.user || { name: "Admin User", foto: null },
      usersList: users,
      message: message,
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    res.render("users", {
      users: { name: "Guest", foto: null },
      usersList: [],
      message: {
        type: "error",
        text: "Terjadi kesalahan saat mengambil data user",
      },
    })
  }
})

// POST route for adding new user
router.post("/users/add", upload.single("foto"), async (req, res) => {
  try {
    console.log("POST /admin/users/add - Request received")
    console.log("Request body:", req.body)
    console.log("Uploaded file:", req.file)

    const { name, email, password, role, phone, address } = req.body

    // Validation
    if (!name || !email || !password || !role) {
      console.log("Validation failed: Missing required fields")
      return res.status(400).json({
        success: false,
        message: "Nama, email, password, dan role wajib diisi",
      })
    }

    if (password.length < 6) {
      console.log("Validation failed: Password too short")
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter",
      })
    }

    // Check if email already exists
    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase())
    if (existingUser) {
      console.log("Validation failed: Email already exists")
      return res.status(400).json({
        success: false,
        message: "Email sudah terdaftar",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Handle file upload
    let fotoPath = null
    if (req.file) {
      fotoPath = "/uploads/users/" + req.file.filename
    }

    // Create new user
    const newUser = {
      id: nextId++,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: role,
      phone: phone || null,
      address: address || null,
      foto: fotoPath,
      created_at: new Date(),
    }

    users.push(newUser)

    console.log("User created successfully:", {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    })

    res.json({
      success: true,
      message: "User berhasil ditambahkan",
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        foto: newUser.foto,
      },
    })
  } catch (error) {
    console.error("Error adding user:", error)

    // Delete uploaded file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err)
      })
    }

    res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat menambah user",
    })
  }
})

// POST route for deleting user
router.post("/users/delete/:id", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)
    console.log("DELETE user request for ID:", userId)

    const userIndex = users.findIndex((user) => user.id === userId)
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      })
    }

    const user = users[userIndex]

    // Delete user photo if exists
    if (user.foto) {
      const photoPath = path.join(__dirname, "../public", user.foto)
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath)
      }
    }

    // Remove user from array
    users.splice(userIndex, 1)

    console.log("User deleted:", user.name)

    res.json({
      success: true,
      message: "User berhasil dihapus",
    })
  } catch (error) {
    console.error("Error deleting user:", error)
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghapus user",
    })
  }
})

// GET route for viewing single user
router.get("/users/view/:id", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)
    console.log("GET /admin/users/view/:id - Request for user ID:", userId)

    const user = users.find((user) => user.id === userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      })
    }

    // Don't send password in response
    const { password, ...userWithoutPassword } = user

    res.json({
      success: true,
      data: userWithoutPassword,
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data user",
    })
  }
})

// POST route for editing user
router.post("/users/edit/:id", upload.single("foto"), async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)
    console.log("POST /admin/users/edit/:id - Request for user ID:", userId)
    console.log("Request body:", req.body)

    const { name, email, password, role, phone, address } = req.body

    // Find user
    const userIndex = users.findIndex((user) => user.id === userId)
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      })
    }

    // Validation
    if (!name || !email || !role) {
      console.log("Validation failed: Missing required fields")
      return res.status(400).json({
        success: false,
        message: "Nama, email, dan role wajib diisi",
      })
    }

    // Check if email already exists (excluding current user)
    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== userId)
    if (existingUser) {
      console.log("Validation failed: Email already exists")
      return res.status(400).json({
        success: false,
        message: "Email sudah digunakan oleh user lain",
      })
    }

    // Update user data
    const user = users[userIndex]
    user.name = name.trim()
    user.email = email.trim().toLowerCase()
    user.role = role
    user.phone = phone || null
    user.address = address || null

    // Update password if provided
    if (password && password.length >= 6) {
      user.password = await bcrypt.hash(password, 10)
    }

    // Handle file upload
    if (req.file) {
      // Delete old photo if exists
      if (user.foto) {
        const oldPhotoPath = path.join(__dirname, "../public", user.foto)
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath)
        }
      }
      user.foto = "/uploads/users/" + req.file.filename
    }

    console.log("User updated successfully:", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    res.json({
      success: true,
      message: "User berhasil diupdate",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        foto: user.foto,
      },
    })
  } catch (error) {
    console.error("Error updating user:", error)

    // Delete uploaded file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err)
      })
    }

    res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan saat mengupdate user",
    })
  }
})

// GET route for edit user page
router.get("/users/edit/:id", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)
    console.log("GET /admin/users/edit/:id - Request for user ID:", userId)

    const user = users.find((user) => user.id === userId)
    if (!user) {
      return res.render("users", {
        users: req.session?.user || { name: "Admin User", foto: null },
        usersList: users,
        message: {
          type: "error",
          text: "User tidak ditemukan",
        },
      })
    }

    // Don't send password in response
    const { password, ...userWithoutPassword } = user

    res.render("edit-user", {
      users: req.session?.user || { name: "Admin User", foto: null },
      user: userWithoutPassword,
      message: null,
    })
  } catch (error) {
    console.error("Error fetching user for edit:", error)
    res.render("users", {
      users: req.session?.user || { name: "Admin User", foto: null },
      usersList: users,
      message: {
        type: "error",
        text: "Terjadi kesalahan saat mengambil data user",
      },
    })
  }
})

// POST route for updating user from edit page
router.post("/users/edit/:id", upload.single("userImage"), async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.id)
    console.log("POST /admin/users/edit/:id - Request for user ID:", userId)
    console.log("Request body:", req.body)

    const { name, email, role, phone, address } = req.body

    // Find user
    const userIndex = users.findIndex((user) => user.id === userId)
    if (userIndex === -1) {
      return res.render("edit-user", {
        users: req.session?.user || { name: "Admin User", foto: null },
        user: req.body,
        message: {
          type: "error",
          text: "User tidak ditemukan",
        },
      })
    }

    // Validation
    if (!name || !email || !role) {
      console.log("Validation failed: Missing required fields")
      return res.render("edit-user", {
        users: req.session?.user || { name: "Admin User", foto: null },
        user: { ...users[userIndex], ...req.body },
        message: {
          type: "error",
          text: "Nama, email, dan role wajib diisi",
        },
      })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.render("edit-user", {
        users: req.session?.user || { name: "Admin User", foto: null },
        user: { ...users[userIndex], ...req.body },
        message: {
          type: "error",
          text: "Format email tidak valid",
        },
      })
    }

    // Check if email already exists (excluding current user)
    const existingUser = users.find((user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== userId)
    if (existingUser) {
      console.log("Validation failed: Email already exists")
      return res.render("edit-user", {
        users: req.session?.user || { name: "Admin User", foto: null },
        user: { ...users[userIndex], ...req.body },
        message: {
          type: "error",
          text: "Email sudah digunakan oleh user lain",
        },
      })
    }

    // Update user data
    const user = users[userIndex]
    user.name = name.trim()
    user.email = email.trim().toLowerCase()
    user.role = role
    user.phone = phone?.trim() || null
    user.address = address?.trim() || null

    // Handle file upload
    if (req.file) {
      // Delete old photo if exists
      if (user.foto) {
        const oldPhotoPath = path.join(__dirname, "../public", user.foto)
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath)
        }
      }
      user.foto = "/uploads/users/" + req.file.filename
    }

    console.log("User updated successfully:", {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })

    // Redirect to users page with success message
    res.redirect("/admin/users?message=User berhasil diupdate&type=success")
  } catch (error) {
    console.error("Error updating user:", error)

    // Delete uploaded file if error occurs
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting file:", err)
      })
    }

    res.render("edit-user", {
      users: req.session?.user || { name: "Admin User", foto: null },
      user: req.body,
      message: {
        type: "error",
        text: "Terjadi kesalahan saat mengupdate user",
      },
    })
  }
})

module.exports = router
