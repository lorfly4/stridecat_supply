const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const path = require("path");
const session = require("express-session"); // Import express-session
const db = require("./db"); // Import the database connection
const util = require("util");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload()); // Middleware untuk file upload
app.use(express.static(path.join(__dirname, "public")));
app.use("/img", express.static(path.join(__dirname, "views", "img"))); // Folder gambar

// Setup session
app.use(
  session({
    secret: "rahasia", // Ganti dengan kunci rahasia Anda
    resave: false,
    saveUninitialized: true,
  })
);

// Set View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/daftar", (req, res) => {
  res.render("daftar");
});

/**
 * CRUD Users
 */

// List all users (admin only)
app.get("/admin/users", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");
  try {
    const usersResult = await db.query("SELECT * FROM users ORDER BY id ASC");
    const user = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    res.render("admin/users", {
      usersList: usersResult.rows,
      users: user.rows[0], // ⬅️ Kirim user login ke EJS
      message: null
    });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data users" });
  }
});

// Show add user form
app.get("/admin/users/tambah", (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");
  res.render("admin/tambah_user", { message: null });
});

// Handle add user
app.post("/admin/users/tambah", async (req, res) => {
  const { name, email, password, role } = req.body;
  const foto = req.files ? req.files.foto : null;
  if (!name || !email || !password || !role || !foto) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }
  const fotoName = Date.now() + "_" + foto.name;
  const fotoPath = path.join(__dirname, "public", "img", fotoName);
  foto.mv(fotoPath, async (err) => {
    if (err) return res.status(500).json({ error: "Gagal upload foto" });
    try {
      await db.query(
        "INSERT INTO users (name, email, password, foto, role) VALUES ($1, $2, $3, $4, $5)",
        [name, email, password, `/img/${fotoName}`, role]
      );
      res.redirect("/admin/users?success=true");
    } catch (err) {
      res.status(500).json({ error: "Gagal menyimpan user" });
    }
  });
});

// Show edit user form
app.get("/admin/users/edit/:id", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");
  const userId = req.params.id;
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User tidak ditemukan" });
    res.render("admin/edit_user", { user: userResult.rows[0], message: null });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
});

// Handle edit user
app.post("/admin/users/edit/:id", async (req, res) => {
  const userId = req.params.id;
  let { name, email, password, role } = req.body;
  let foto = req.files ? req.files.foto : null;
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User tidak ditemukan" });
    let fotoPath = userResult.rows[0].foto;
    if (!password) password = userResult.rows[0].password;
    const updateUser = async () => {
      try {
        await db.query(
          "UPDATE users SET name=$1, email=$2, password=$3, foto=$4, role=$5 WHERE id=$6",
          [name, email, password, fotoPath, role, userId]
        );
        res.redirect("/admin/users?success=true");
      } catch (err) {
        res.status(500).json({ error: "Gagal update user" });
      }
    };
    if (foto) {
      const fotoName = Date.now() + "_" + foto.name;
      fotoPath = `/img/${fotoName}`;
      foto.mv(path.join(__dirname, "public", "img", fotoName), async (err) => {
        if (err) return res.status(500).json({ error: "Gagal upload foto" });
        await updateUser();
      });
    } else {
      await updateUser();
    }
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
});

// Handle delete user
app.get("/admin/users/hapus/:id", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");
  const userId = req.params.id;
  try {
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
    res.redirect("/admin/users?success=true");
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus user" });
  }
});

app.get("/admin/produk", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = userResult.rows[0];
    const produkResult = await db.query("SELECT * FROM produk");
    res.render("admin/produk", { users: user, produkList: produkResult.rows, message: null });
    console.log("Produk List:", produkResult.rows);
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
    console.log(err);
  }
});

app.get("/admin/produk/tambah", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = userResult.rows[0];
    res.render("admin/tambah_produk", { users: user, message: null });
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});

app.post("/admin/produk/tambah", async (req, res) => {
  const { name, jumlah_produk, harga } = req.body;
  const foto = req.files ? req.files.foto : null;

  if (!name || !jumlah_produk || !harga || !foto) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const fotoName = Date.now() + "_" + foto.name;
  const fotoPath = path.join(__dirname, "public", "img", fotoName);

  foto.mv(fotoPath, async (err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal upload foto" });
    }
    try {
      await db.query(
        "INSERT INTO produk (nama_produk, foto, harga, jumlah_barang) VALUES ($1, $2, $3, $4)",
        [name, `/img/${fotoName}`, harga, jumlah_produk]
      );
      res.redirect("/admin/produk?success=true");
    } catch (err) {
      res.status(500).json({ error: "Gagal menyimpan data" });
      console.log(err);
    }
  });
});

app.get("/admin/produk/edit/:id", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const produkId = req.params.id;
  try {
    const usersResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (usersResult.rows.length === 0) return res.status(500).json({ error: "User not found" });
    const produkResult = await db.query("SELECT * FROM produk WHERE id_produk = $1", [produkId]);
    if (produkResult.rows.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.render("admin/edit_produk", { users: usersResult.rows[0], produk: produkResult.rows[0], message: null });
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
    console.log(err);
  }
});

app.post("/admin/produk/edit/:id", async (req, res) => {
  const produkId = req.params.id;
  const { name, jumlah_barang, harga } = req.body;
  let foto = req.files ? req.files.foto : null;

  try {
    const result = await db.query("SELECT * FROM produk WHERE id_produk = $1", [produkId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });

    let fotoPath = result.rows[0].foto;
    const updateProduk = async () => {
      try {
        await db.query(
          "UPDATE produk SET nama_produk=$1, jumlah_barang=$2, harga=$3, foto=$4 WHERE id_produk=$5",
          [name, jumlah_barang, harga, fotoPath, produkId]
        );
        res.redirect("/admin/produk?success=true");
      } catch (err) {
        res.status(500).json({ error: "Gagal update produk" });
        console.log(err);
      }
    };

    if (foto) {
      const fotoName = Date.now() + "_" + foto.name;
      fotoPath = `/img/${fotoName}`;
      foto.mv(path.join(__dirname, "public", "img", fotoName), async (err) => {
        if (err) return res.status(500).json({ error: "Gagal upload foto" });
        await updateProduk();
      });
    } else {
      await updateProduk();
    }
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
    console.log(err);
  }
});

app.get("/admin/produk/hapus/:id", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const produkId = req.params.id;
  try {
    await db.query("DELETE FROM produk WHERE id_produk = $1", [produkId]);
    res.redirect("/admin/produk?success=true");
  } catch (err) {
    console.log("Gagal hapus produk:", err);
    res.status(500).json({ error: "Gagal hapus produk" });
  }
});

app.get("/admin/history", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      console.log("User not found saat akses history");
      return res.status(500).json({ error: "User not found" });
    }
    const user = result.rows[0];
    const sql = `
      SELECT hp.*, u.name as nama_pembeli, p.nama_produk, p.harga, p.foto
      FROM history_pembelian hp
      JOIN users u ON hp.id_user = u.id
      JOIN produk p ON hp.id_produk = p.id_produk
      ORDER BY hp.tanggal DESC
    `;
    const historyResult = await db.query(sql);
    res.render("admin/history_pembelian", {
      users: user,
      history: historyResult.rows,
      message: null
    });
  } catch (err) {
    console.log("Gagal ambil data history:", err);
    res.status(500).json({ error: "Gagal ambil data history" });
  }
});

// Tampilkan form edit history pembelian
app.get("/admin/history/:id/edit", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const id = req.params.id;
  try {
    const result = await db.query(
      `SELECT hp.*, u.name as nama_pembeli, p.nama_produk, p.harga, p.foto
       FROM history_pembelian hp
       JOIN users u ON hp.id_user = u.id
       JOIN produk p ON hp.id_produk = p.id_produk
       WHERE hp.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      console.log("Data history tidak ditemukan untuk edit:", id);
      return res.status(404).send("Data tidak ditemukan");
    }
    res.render("admin/edit_history", { history: result.rows[0], users: req.session.userId, message: null });
  } catch (err) {
    console.log("Gagal ambil data history untuk edit:", err);
    res.status(500).json({ error: "Gagal ambil data history" });
  }
});

// Proses edit history pembelian
app.post("/admin/history/:id/edit", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const id = req.params.id;
  const { status, tanggal, metode_pembayaran, resi, jasa_pengiriman } = req.body;
  try {
    await db.query(
      `UPDATE history_pembelian SET status=$1, tanggal=$2, metode_pembayaran=$3, resi=$4, jasa_pengiriman=$5 WHERE id=$6`,
      [status, tanggal, metode_pembayaran, resi, jasa_pengiriman, id]
    );
    res.redirect("/admin/history?success=true");
  } catch (err) {
    console.log("Gagal update history pembelian:", err);
    res.status(500).json({ error: "Gagal update history pembelian" });
  }
});

app.get("/admin/history/:id/hapus", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const id = req.params.id;
  try {
    await db.query("DELETE FROM history_pembelian WHERE id = $1", [id]);
    res.redirect("/admin/history?success=true");
  } catch (err) {
    console.log("Gagal hapus history pembelian:", err);
    res.status(500).json({ error: "Gagal hapus history pembelian" });
  }
});


app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.render("login", { message: "username dan password wajib diisi" });
  }
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE name = $1 AND password = $2",
      [name, password]
    );
    if (result.rows.length === 0) {
      return res.render("login", { message: "username atau password salah" });
    }
    const user = result.rows[0];
    req.session.userId = user.id;
    req.session.role = user.role;
    if (user.role === "admin") {
      return res.redirect("/admin/landing");
    } else {
      return res.redirect("/landing");
    }
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});

app.get("/admin/landing", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.redirect("/login");
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = result.rows[0];
    res.render("admin/landing", { users: user, message: null });
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});

app.get("/landing", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = result.rows[0];
    res.render("user/landing", { users: user, message: null });
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});
app.get("/produk", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = result.rows[0];
    res.render("user/produk", { users: user, message: null });
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});

app.post("/daftar", async (req, res) => {
  const { name, email, password, role } = req.body;
  const foto = req.files ? req.files.foto : null;

  if (!name || !email || !password || !foto) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const fotoName = Date.now() + "_" + foto.name;
  const fotoPath = path.join(__dirname, "public", "img", fotoName);

  foto.mv(fotoPath, async (err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal upload foto" });
    }
    try {
      await db.query(
        "INSERT INTO users (name, email, password, foto, role) VALUES ($1, $2, $3, $4, $5)",
        [name, email, password, `/img/${fotoName}`, role]
      );
      // Kirim pesan sukses ke halaman login untuk SweetAlert
      res.render("login", { session: "success" }); // ⬅️ Tambahkan session: "success"
    } catch (err) {
      res.status(500).json({ error: "Gagal menyimpan user" });
    }
  });
});

app.get("/admin/profil", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0];
    res.render("admin/profil", { users: user });
  } catch (err) {
    console.error("QUERY ERROR:", err); // ⬅️ Ini penting!
    res.status(500).json({ error: "Error querying database" });
  }
});

// filepath: [server.js](http://_vscodecontentref_/3)
app.post("/admin/profil", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  let { name, email, password } = req.body;
  let foto = req.files ? req.files.foto : null;

  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    let fotoPath = result.rows[0].foto;
    if (!password) password = result.rows[0].password; // gunakan password lama jika kosong

    const updateProfil = async () => {
      try {
        // Ganti 'name' dengan 'nama' jika di database kolomnya 'nama'
        await db.query(
          "UPDATE users SET name=$1, email=$2, password=$3, foto=$4 WHERE id=$5",
          [name, email, password, fotoPath, req.session.userId]
        );
        res.redirect("/admin/profil?success=true");
      } catch (err) {
        res.status(500).json({ error: "Gagal update profil" });
        console.log(err);
      }
    };

    if (foto) {
      const fotoName = Date.now() + "_" + foto.name;
      fotoPath = `/img/${fotoName}`;
      foto.mv(path.join(__dirname, "public", "img", fotoName), async (err) => {
        if (err) return res.status(500).json({ error: "Gagal upload foto" });
        await updateProfil();
      });
    } else {
      await updateProfil();
    }
  } catch (err) {
    res.status(500).json({ error: "Error querying database" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal logout" });
    }
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
