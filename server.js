const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const path = require("path");
const session = require("express-session"); // Import express-session
const db = require("./db"); // Import the database connection

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

// Route Halaman Daftar
app.get("/daftar", (req, res) => {
  res.render("daftar");
});

app.get("/produk", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];

      // Ambil data produk dari database
      db.query(
        "SELECT * FROM produk",
        (err, rows2) => {
          if (err) {
            return res.status(500).json({ error: "Error querying database" });
          }

          res.render("produk", { users: user, produkList: rows2, message: null }); // Kirim message: null
        }
      );
    }
  );
});

app.get("/produk/tambah", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];
      res.render("tambah_produk", { users: user, message: null }); // Kirim message: null
    }
  );
});

app.post("/produk/tambah", (req, res) => {
  const { name, jumlah_produk, harga } = req.body;
  const foto = req.files ? req.files.foto : null;

  if (!name || !jumlah_produk || !harga || !foto) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  // Simpan file foto ke folder public/img
  const fotoName = Date.now() + "_" + foto.name;
  const fotoPath = path.join(__dirname, "public", "img", fotoName);

  foto.mv(fotoPath, (err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal upload foto" });
    }

    // Simpan ke database, simpan path foto (misal: /img/namafile.jpg)
    db.query(
      "INSERT INTO produk (nama_produk, foto, harga, jumlah_produk) VALUES (?, ?, ?, ?)",
      [name, `/img/${fotoName}`, harga, jumlah_produk],
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Gagal menyimpan data" });
        }

        res.redirect("/produk?success=true");
      }
    );
  });
});

app.get("/produk/edit/:id", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const produkId = req.params.id;

  db.query("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, users) => {
    if (err || users.length === 0) return res.status(500).json({ error: "User not found" });

    db.query("SELECT * FROM produk WHERE id = ?", [produkId], (err, produkRows) => {
      if (err || produkRows.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });

      res.render("edit_produk", { users: users[0], produk: produkRows[0], message: null });
    });
  });
});

app.post("/produk/edit/:id", (req, res) => {
  const produkId = req.params.id;
  const { name, jumlah_barang, harga } = req.body;
  let foto = req.files ? req.files.foto : null;

  // Ambil data lama jika tidak upload foto baru
  db.query("SELECT * FROM produk WHERE id = ?", [produkId], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });

    let fotoPath = rows[0].foto;
    if (foto) {
      const fotoName = Date.now() + "_" + foto.name;
      fotoPath = `/img/${fotoName}`;
      foto.mv(path.join(__dirname, "public", "img", fotoName), (err) => {
        if (err) return res.status(500).json({ error: "Gagal upload foto" });
        updateProduk();
      });
    } else {
      updateProduk();
    }

    function updateProduk() {
      db.query(
        "UPDATE produk SET nama_produk=?, jumlah_barang=?, harga=?, foto=? WHERE id=?",
        [name, jumlah_barang, harga, fotoPath, produkId],
        (err) => {
          if (err) return res.status(500).json({ error: "Gagal update produk" });
          res.redirect("/produk?success=true");
        }
      );
    }
  });
});

app.get("/produk/hapus/:id", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const produkId = req.params.id;
  db.query("DELETE FROM produk WHERE id = ?", [produkId], (err) => {
    if (err) return res.status(500).json({ error: "Gagal hapus produk" });
    res.redirect("/produk?success=true");
  });
});

app.get("/history", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  // Ambil data pengguna yang login
  db.query("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, rows) => {
    if (err || rows.length === 0) return res.status(500).json({ error: "User not found" });

    const user = rows[0];

    // Ambil history pembelian + join user dan produk
    const sql = `
      SELECT hp.*, u.name as nama_pembeli, p.nama_produk, p.harga, p.foto
      FROM history_pembelian hp
      JOIN users u ON hp.id_user = u.id
      JOIN produk p ON hp.id_produk = p.id_produk
      ORDER BY hp.tanggal DESC
    `;

    db.query(sql, (err, historyRows) => {
      if (err) return res.status(500).json({ error: "Gagal ambil data history" });

      res.render("history_pembelian", {
        users: user,
        history: historyRows,
        message: null
      });
    });
  });
});

// ...existing code...

// Tampilkan form edit history pembelian
app.get("/history/:id/edit", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const id = req.params.id;
  db.query(
    `SELECT hp.*, u.name as nama_pembeli, p.nama_produk, p.harga, p.foto
     FROM history_pembelian hp
     JOIN users u ON hp.id_user = u.id
     JOIN produk p ON hp.id_produk = p.id_produk
     WHERE hp.id = ?`,
    [id],
    (err, rows) => {
      if (err || rows.length === 0) return res.status(404).send("Data tidak ditemukan");
      res.render("edit_history", { history: rows[0], users: req.session.userId, message: null });
    }
  );
});

// Proses edit history pembelian
app.post("/history/:id/edit", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const id = req.params.id;
  const { status, tanggal, metode_pembayaran, resi, jasa_pengiriman } = req.body;

  db.query(
    `UPDATE history_pembelian SET status=?, tanggal=?, metode_pembayaran=?, resi=?, jasa_pengiriman=? WHERE id=?`,
    [status, tanggal, metode_pembayaran, resi, jasa_pengiriman, id],
    (err) => {
      if (err) return res.status(500).json({ error: "Gagal update history pembelian" });
      res.redirect("/history?success=true");
    }
  );
});

// ...existing code...

app.get("/history/:id/hapus", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const id = req.params.id;
  db.query("DELETE FROM history_pembelian WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: "Gagal hapus history pembelian" });
    res.redirect("/history?success=true");
  });
});

// Landing Page
app.get("/", (req, res) => {
  res.render("index");
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// API Login
app.post("/login", (req, res) => {
  const { name, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE name = ? AND password = ? LIMIT 1",
    [name, password],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Gagal login" });
      }

      if (rows.length === 0) {
        return res.status(401).json({ error: "Nama atau password salah" });
      }

      const user = rows[0];
      req.session.userId = user.id; // Simpan ID pengguna di sesi

      res.redirect("/landing"); // Redirect ke halaman profil setelah login
    }
  );
});

// Route untuk halaman landing
app.get("/landing", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];
      res.render("landing", { users: user, message: null }); // Kirim message: null
    }
  );
});

// Handle Registrasi
app.post("/daftar", (req, res) => {
  // Debug log untuk memantau data
  console.log("Request Body:", req.body);
  console.log("Request Files:", req.files);

  // Validasi jika file tidak diunggah
  if (!req.files || !req.files.foto) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { nomor_keanggotaan, nama, divisi, password } = req.body;
  const file = req.files.foto;

  // Nama dan lokasi file
  const fotoName = Date.now() + "_" + file.name; // Tambah timestamp agar nama unik
  const fotoPath = path.join(__dirname, "public", "img", fotoName);

  // Pindahkan file ke lokasi tujuan
  file.mv(fotoPath, (err) => {
    if (err) {
      console.error("File Upload Error:", err.message);
      return res.status(500).json({ error: "Failed to upload file." });
    }

    // Simpan data ke database
    db.query(
      "INSERT INTO users (nomor_keanggotaan, nama, divisi, password, foto) VALUES (?, ?, ?, ?, ?)",
      [nomor_keanggotaan, nama, divisi, password, `/img/${fotoName}`],
      (err, results) => {
        if (err) {
          console.error("Database Error:", err.message);
          return res.status(500).json({ error: "Failed to save user." });
        }
        console.log("User  Registered:", results);
        res.render("login"); // Redirect ke halaman login setelah registrasi
      }
    );
  });
});

// Route untuk menampilkan halaman profil
app.get("/profil", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  // Ambil data pengguna dari database
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Error querying database" });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User  not found" });
      }

      const user = rows[0];
      res.render("profil", { users: user }); // Render halaman profil dengan data pengguna
    }
  );
});

// Route untuk logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Gagal logout" });
    }
    res.redirect("/"); // Redirect ke halaman utama setelah logout
  });
});

app.get("/peminjaman", (req, res) => {
  console.log("Query Parameters:", req.query);

  if (!req.session.userId) {
    return res.redirect("/login"); // Redirect jika pengguna tidak login
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const DateYear = req.query.DateYear || currentYear;
  const DateMonth = req.query.DateMonth || currentMonth;

  if (
    isNaN(DateYear) ||
    isNaN(DateMonth) ||
    DateMonth < 1 ||
    DateMonth > 12
  ) {
    return res
      .status(400)
      .json({ error: "Invalid or missing DateYear or DateMonth" });
  }

  // Ambil data pengguna
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Failed to retrieve user data." });
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = rows[0];

      // Periksa jumlah peminjaman untuk DateYear dan DateMonth tertentu
      db.query(
        "SELECT COUNT(*) as count FROM peminjaman WHERE DateYear = ? AND DateMonth = ?",
        [DateYear, DateMonth],
        (err, result) => {
          if (err) {
            return res
              .status(500)
              .json({ error: "Failed to query loan data from database." });
          }

          const count = result[0].count;

          // Jika data berjumlah 3 atau lebih, tolak akses
          if (count >= 3) {
            return res.render("landing", {
              users: user, // Kirim data pengguna
              message: `Peminjaman untuk bulan ${DateMonth} tahun ${DateYear} sudah mencapai batas maksimum (3 peminjaman).`,
            });
          }

          // Tampilkan halaman peminjaman
          res.render("peminjaman", { users: user });
        }
      );
    }
  );
});


// API untuk memasukan data ke dalam database
app.post("/peminjaman", (req, res) => {
  const {
    id,
    nomor_keanggotaan,
    nama,
    divisi,
    pinjaman,
    cicilan,
    cicilan_perbulan,
    tanggal,
  } = req.body;

  if (
    !id ||
    !nomor_keanggotaan ||
    !nama ||
    !divisi ||
    !pinjaman ||
    !cicilan ||
    !cicilan_perbulan ||
    !tanggal
  ) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const tanggalObj = new Date(tanggal);
  const dateDay = String(tanggalObj.getDate()).padStart(2, "0"); // dd
  const DateMonth = String(tanggalObj.getMonth() + 1).padStart(2, "0"); // mm
  const DateYear = tanggalObj.getFullYear(); // yyyy

  const fullDate = `${dateDay}-${DateMonth}-${DateYear}`;

  // Simpan data ke database
  db.query(
    "INSERT INTO peminjaman (nomor_keanggotaan, nama, divisi, pinjaman, cicilan, cicilan_perbulan, tanggal, DateMonth, DateYear, userID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      nomor_keanggotaan,
      nama,
      divisi,
      pinjaman,
      cicilan,
      cicilan_perbulan,
      fullDate,
      DateMonth,
      DateYear,
      id,
    ],
    (err, results) => {
      if (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Gagal menyimpan data" });
      }

      console.log("Data berhasil disimpan:", results);

      // Redirect dengan parameter success=true
      res.redirect("/landing?success=true");
    }
  );
});

// Menjalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});

