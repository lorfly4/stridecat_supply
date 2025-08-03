const express = require("express")
const router = express.Router()
const db = require("../db")
const bcrypt = require("bcrypt")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

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

// READ - Get all users (for page rendering)
router.get("/", (req, res) => {
  try {
    console.log("GET /users - Loading users page")

    const query = "SELECT id, name, email, role, phone, address, foto, created_at FROM users ORDER BY created_at DESC"

    db.query(query, (err, results) => {
      if (err) {
        console.error("Database error:", err)
        return res.render("users", {
          users: req.session?.user || { name: "Admin User", foto: null },
          usersList: [],
          message: {
            type: "error",
            text: "Terjadi kesalahan saat mengambil data user",
          },
        })
      }

      let message = null
      if (req.query.message && req.query.type) {
        message = {
          type: req.query.type,
          text: req.query.message,
        }
      }

      res.render("users", {
        users: req.session?.user || { name: "Admin User", foto: null },
        usersList: results || [],
        message: message,
      })
    })
  } catch (error) {
    console.error("Error in GET /users:", error)
    res.render("users", {
      users: { name: "Guest", foto: null },
      usersList: [],
      message: {
        type: "error",
        text: "Terjadi kesalahan saat memuat halaman",
      },
    })
  }
})

// FORM ADD - Show add user form
router.get("/add", (req, res) => {
  res.render("users/add", {
    users: req.session?.user || { name: "Admin User", foto: null },
  })
})

// ADD - Create new user (AJAX endpoint)
router.post("/add", upload.single("foto"), async (req, res) => {
  try {
    console.log("POST /users/add - Request received")
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
    const checkEmailQuery = "SELECT id FROM users WHERE email = ?"
    db.query(checkEmailQuery, [email.toLowerCase()], async (err, existingUsers) => {
      if (err) {
        console.error("Database error checking email:", err)
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan saat validasi email",
        })
      }

      if (existingUsers.length > 0) {
        console.log("Validation failed: Email already exists")
        return res.status(400).json({
          success: false,
          message: "Email sudah terdaftar",
        })
      }

      try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Handle file upload
        let fotoPath = null
        if (req.file) {
          fotoPath = "/uploads/users/" + req.file.filename
        }

        // Insert new user
        const insertQuery = `
          INSERT INTO users (name, email, password, role, phone, address, foto, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `

        const values = [
          name.trim(),
          email.trim().toLowerCase(),
          hashedPassword,
          role,
          phone || null,
          address || null,
          fotoPath,
        ]

        db.query(insertQuery, values, (err, result) => {
          if (err) {
            console.error("Database error inserting user:", err)

            // Delete uploaded file if error occurs
            if (req.file) {
              fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file:", unlinkErr)
              })
            }

            return res.status(500).json({
              success: false,
              message: "Terjadi kesalahan saat menyimpan user",
            })
          }

          console.log("User created successfully with ID:", result.insertId)

          res.json({
            success: true,
            message: "User berhasil ditambahkan",
            data: {
              id: result.insertId,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              role: role,
              foto: fotoPath,
            },
          })
        })
      } catch (hashError) {
        console.error("Error hashing password:", hashError)
        res.status(500).json({
          success: false,
          message: "Terjadi kesalahan saat memproses password",
        })
      }
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

// FORM EDIT - Show edit user form
router.get("/edit/:id", (req, res) => {
  const userId = req.params.id

  console.log("GET /users/edit/:id - Request for user ID:", userId)

  // Query to get user data - handle both id and id_user field names
  const query = `
    SELECT 
      id, 
      id as id_user,
      name, 
      name as nama,
      email, 
      role, 
      phone, 
      address, 
      foto 
    FROM users 
    WHERE id = ?
  `

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error("Database error:", err)
      return res.redirect("/users?message=Terjadi kesalahan saat mengambil data user&type=error")
    }

    if (result.length === 0) {
      console.log("User not found for ID:", userId)
      return res.redirect("/users?message=User tidak ditemukan&type=error")
    }

    console.log("User found:", result[0])

    res.render("edit-user", {
      users: req.session?.user || { name: "Admin User", foto: null },
      user: result[0],
      message: null,
    })
  })
})

// UPDATE - Update user
router.post("/edit/:id", upload.single("userImage"), async (req, res) => {
  try {
    const userId = req.params.id
    const { name, email, role, phone, address } = req.body

    console.log("POST /users/edit/:id - Request for user ID:", userId)
    console.log("Request body:", req.body)

    // Validation
    if (!name || !email || !role) {
      return res.render("edit-user", {
        users: req.session?.user || { name: "Admin User", foto: null },
        user: { id: userId, ...req.body },
        message: {
          type: "error",
          text: "Nama, email, dan role wajib diisi",
        },
      })
    }

    // Check if user exists
    db.query("SELECT * FROM users WHERE id = ?", [userId], (err, userResult) => {
      if (err) {
        console.error("Database error:", err)
        return res.render("edit-user", {
          users: req.session?.user || { name: "Admin User", foto: null },
          user: { id: userId, ...req.body },
          message: {
            type: "error",
            text: "Terjadi kesalahan saat mengambil data user",
          },
        })
      }

      if (userResult.length === 0) {
        return res.redirect("/users?message=User tidak ditemukan&type=error")
      }

      const currentUser = userResult[0]

      // Check if email already exists (excluding current user)
      const checkEmailQuery = "SELECT id FROM users WHERE email = ? AND id != ?"
      db.query(checkEmailQuery, [email.toLowerCase(), userId], (err, existingUsers) => {
        if (err) {
          console.error("Database error checking email:", err)
          return res.render("edit-user", {
            users: req.session?.user || { name: "Admin User", foto: null },
            user: { id: userId, ...req.body },
            message: {
              type: "error",
              text: "Terjadi kesalahan saat validasi email",
            },
          })
        }

        if (existingUsers.length > 0) {
          return res.render("edit-user", {
            users: req.session?.user || { name: "Admin User", foto: null },
            user: { id: userId, ...req.body },
            message: {
              type: "error",
              text: "Email sudah digunakan oleh user lain",
            },
          })
        }

        // Handle file upload
        let fotoPath = currentUser.foto
        if (req.file) {
          // Delete old photo if exists
          if (currentUser.foto) {
            const oldPhotoPath = path.join(__dirname, "../public", currentUser.foto)
            if (fs.existsSync(oldPhotoPath)) {
              fs.unlinkSync(oldPhotoPath)
            }
          }
          fotoPath = "/uploads/users/" + req.file.filename
        }

        // Update user
        const updateQuery = `
          UPDATE users 
          SET name = ?, email = ?, role = ?, phone = ?, address = ?, foto = ?
          WHERE id = ?
        `

        const values = [
          name.trim(),
          email.trim().toLowerCase(),
          role,
          phone?.trim() || null,
          address?.trim() || null,
          fotoPath,
          userId,
        ]

        db.query(updateQuery, values, (err, result) => {
          if (err) {
            console.error("Database error updating user:", err)

            // Delete uploaded file if error occurs
            if (req.file) {
              fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file:", unlinkErr)
              })
            }

            return res.render("edit-user", {
              users: req.session?.user || { name: "Admin User", foto: null },
              user: { id: userId, ...req.body },
              message: {
                type: "error",
                text: "Terjadi kesalahan saat mengupdate user",
              },
            })
          }

          console.log("User updated successfully:", userId)
          res.redirect("/users?message=User berhasil diupdate&type=success")
        })
      })
    })
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
      user: { id: req.params.id, ...req.body },
      message: {
        type: "error",
        text: "Terjadi kesalahan saat mengupdate user",
      },
    })
  }
})

// DELETE - Delete user (AJAX endpoint)
router.post("/delete/:id", (req, res) => {
  const userId = req.params.id

  console.log("DELETE user request for ID:", userId)

  // First get user data to delete photo
  db.query("SELECT foto FROM users WHERE id = ?", [userId], (err, result) => {
    if (err) {
      console.error("Database error:", err)
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat menghapus user",
      })
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      })
    }

    const user = result[0]

    // Delete user from database
    db.query("DELETE FROM users WHERE id = ?", [userId], (err, deleteResult) => {
      if (err) {
        console.error("Database error deleting user:", err)
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan saat menghapus user",
        })
      }

      // Delete user photo if exists
      if (user.foto) {
        const photoPath = path.join(__dirname, "../public", user.foto)
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath)
        }
      }

      console.log("User deleted successfully:", userId)

      res.json({
        success: true,
        message: "User berhasil dihapus",
      })
    })
  })
})

// API VIEW USER by ID (untuk AJAX di modal edit/view)
router.get("/view/:id", (req, res) => {
  const userId = req.params.id

  console.log("GET /users/view/:id - Request for user ID:", userId)

  db.query(
    "SELECT id, name, email, role, phone, address, foto, created_at FROM users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err) {
        console.error("Database error:", err)
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan saat mengambil data user",
        })
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User tidak ditemukan",
        })
      }

      return res.json({
        success: true,
        data: results[0],
      })
    },
  )
})

// Legacy DELETE route (for backward compatibility)
router.get("/delete/:id", (req, res) => {
  const userId = req.params.id

  // First get user data to delete photo
  db.query("SELECT foto FROM users WHERE id = ?", [userId], (err, result) => {
    if (err) {
      console.error("Database error:", err)
      return res.redirect("/users?message=Terjadi kesalahan saat menghapus user&type=error")
    }

    if (result.length === 0) {
      return res.redirect("/users?message=User tidak ditemukan&type=error")
    }

    const user = result[0]

    // Delete user from database
    db.query("DELETE FROM users WHERE id = ?", [userId], (err, deleteResult) => {
      if (err) {
        console.error("Database error deleting user:", err)
        return res.redirect("/users?message=Terjadi kesalahan saat menghapus user&type=error")
      }

      // Delete user photo if exists
      if (user.foto) {
        const photoPath = path.join(__dirname, "../public", user.foto)
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath)
        }
      }

      console.log("User deleted successfully:", userId)
      res.redirect("/users?message=User berhasil dihapus&type=success")
    })
  })
})

module.exports = router
