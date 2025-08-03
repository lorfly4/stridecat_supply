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
app.get("/admin/users/add", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");

  try {
    // Ambil semua data user
    const usersResult = await db.query("SELECT * FROM users");

    // Ambil data admin yang sedang login
    const userData = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);

    res.render("admin/tambah_user", {
      usersList: usersResult.rows,
      users: userData.rows[0] || null,
      message: null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data users" });
  }
});


// Handle add user
app.post("/admin/users/tambah", async (req, res) => {
  const { name, email, password, role, phone, address } = req.body;
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
        "INSERT INTO users (name, email, password, foto, role, phone, address) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [name, email, password, `/img/${fotoName}`, role, phone, address]
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
    const usersResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    res.render("admin/edit_user", { user: userResult.rows[0], users: usersResult.rows[0] || null, message: null });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
});

// Handle edit user
app.post("/admin/users/edit/:id", async (req, res) => {
  const userId = req.params.id;
  let { name, email, password, role, phone, address  } = req.body;
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
app.post("/admin/users/delete/:id", async (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") return res.redirect("/login");
  const userId = req.params.id;
  try {
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
    res.redirect("/admin/users?success=true");
  } catch (err) {
    res.status(500).json({ "error": "Gagal hapus user" });
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
  const { name, jumlah_produk, harga, kategori, deskripsi } = req.body;
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
        "INSERT INTO produk (nama_produk, foto, harga, jumlah_barang, kategori, deskripsi) VALUES ($1, $2, $3, $4, $5, $6)",
        [name, `/img/${fotoName}`, harga, jumlah_produk, kategori, deskripsi]
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
  const { name, jumlah_barang, harga, kategori, deskripsi } = req.body;
  let foto = req.files ? req.files.foto : null;

  try {
    const result = await db.query("SELECT * FROM produk WHERE id_produk = $1", [produkId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Produk tidak ditemukan" });

    let fotoPath = result.rows[0].foto;
    const updateProduk = async () => {
      try {
        await db.query(
          "UPDATE produk SET nama_produk=$1, jumlah_barang=$2, harga=$3, kategori=$4, deskripsi=$5, foto=$6 WHERE id_produk=$7",
          [name, jumlah_barang, harga, kategori, deskripsi, fotoPath, produkId]
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
      message: null,
      tanggal_mulai: "",
      tanggal_akhir: ""
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
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (userResult.rows.length === 0) {
      console.log("User not found saat akses edit history");
      return res.status(404).json({ error: "User not found" });
    }
    const user = userResult.rows[0];
    res.render("admin/edit_history", { history: result.rows[0], users: user, message: null });
  } catch (err) {
    console.log("Gagal ambil data history untuk edit:", err);
    res.status(500).json({ error: "Gagal ambil data history" });
  }
});

// Proses edit history pembelian
app.post("/admin/history/:id/edit", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  const id = req.params.id;
  const { status, resi, jasa_pengiriman } = req.body;
  try {
    await db.query(
      `UPDATE history_pembelian SET status=$1, resi=$2, jasa_pengiriman=$3 WHERE id=$4`,
      [status, resi, jasa_pengiriman, id]
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


app.get("/admin/history/cari", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const { tanggal_mulai, tanggal_akhir } = req.query;

  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = userResult.rows[0];

    let sql = `
      SELECT hp.*, u.name as nama_pembeli, p.nama_produk, p.harga, p.foto
      FROM history_pembelian hp
      JOIN users u ON hp.id_user = u.id
      JOIN produk p ON hp.id_produk = p.id_produk
    `;
    let params = [];

    // Filter by date range if provided
    if (tanggal_mulai && tanggal_akhir) {
      sql += " WHERE hp.tanggal BETWEEN $1 AND $2";
      params = [tanggal_mulai, tanggal_akhir];
    } else if (tanggal_mulai) {
      sql += " WHERE hp.tanggal >= $1";
      params = [tanggal_mulai];
    } else if (tanggal_akhir) {
      sql += " WHERE hp.tanggal <= $1";
      params = [tanggal_akhir];
    }

    sql += " ORDER BY hp.tanggal DESC";

    const historyResult = await db.query(sql, params);

    res.render("admin/history_pembelian", {
      users: user,
      history: historyResult.rows,
      message: null,
      tanggal_mulai,
      tanggal_akhir
    });
  } catch (err) {
    console.error("Gagal cari history:", err);
    res.status(500).json({ error: "Gagal mencari data history" });
  }
});


app.get("/", async (req, res) => {
  try {
    const produkResult = await db.query("SELECT * FROM produk");
    let produkList = [];
    if (produkResult.rows.length > 0) {
      produkList = produkResult.rows;
    }
    res.render("index", {
      message: null,
      produkList
    });
  } catch (err) {
    console.error("Error querying database:", err);
    res.status(500).json({ error: "Error while querying database" });
  }
});
app.get("/produk/:id_produk", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  const id_produk = req.params.id_produk;
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = result.rows[0];
    const produkResult = await db.query("SELECT * FROM produk WHERE id_produk = $1", [id_produk]);
    if (produkResult.rows.length === 0) {
      return res.status(404).json({ error: "Produk tidak ditemukan" });
    }
    const produk = produkResult.rows[0];
    res.render("user/produk", { users: user, produk, message: null });
  } catch (err) {
    console.error("Error querying database:", err);
    res.status(500).json({ error: "Error while querying database" });
  }
});


// ============================
// 2. ROUTE: /checkout (GET)
// ============================
app.get("/checkout", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login?next=/checkout");
  }

  try {
    // Kirim jumlah juga dari keranjang
    const keranjangResult = await db.query(`
      SELECT k.id_produk, COUNT(*) AS jumlah, p.nama_produk, p.harga, p.foto
      FROM keranjang k
      JOIN produk p ON k.id_produk = p.id_produk
      WHERE k.id_users = $1
      GROUP BY k.id_produk, p.nama_produk, p.harga, p.foto
    `, [req.session.userId]);

    const produkList = keranjangResult.rows.map(row => ({
      id_produk: row.id_produk,
      nama_produk: row.nama_produk,
      harga: parseInt(row.harga),
      jumlah: parseInt(row.jumlah),
      foto: row.foto
    }));

    res.render("user/checkout", { produkList });
  } catch (err) {
    console.error("Gagal ambil data checkout:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data produk.");
  }
});

// ============================
// 3. ROUTE: /bayar (POST)
// ============================
app.post("/bayar", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  let {
    id_produk,
    harga,
    jumlah,
    metode_pembayaran, // Pastikan ini ada
    tanggal,
    status,
    alamat,
    resi,
    jasa_pengiriman
  } = req.body;

  if (!Array.isArray(id_produk)) {
    id_produk = [id_produk];
    harga = [harga];
    jumlah = [jumlah];
  }

  try {
    if (!id_produk || id_produk.length === 0) return res.status(400).send("Produk tidak boleh kosong.");

    const invoiceId = Date.now(); // Generate invoice ID using timestamp

    for (let i = 0; i < id_produk.length; i++) {
      const qty = parseInt(jumlah[i]);
      for (let j = 0; j < qty; j++) {
        const historyResult = await db.query(
          `INSERT INTO history_pembelian 
            (id_produk, id_user, tanggal, status, alamat, resi, jasa_pengiriman, harga, invoice_id, metode_pembayaran, status_pembayaran) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [id_produk[i], req.session.userId, tanggal, status, alamat, resi, jasa_pengiriman, harga[i], invoiceId, metode_pembayaran, "menunggu pembayaran"]
        );

        const id_history = historyResult.rows[0].id;

        await db.query(
          `INSERT INTO pembayaran (nominal, metode_pembayaran, id_user, id_history) 
           VALUES ($1, $2, $3, $4)`,
          [harga[i], metode_pembayaran, req.session.userId, id_history]
        );

        // Kurangi stock produk
        await db.query(
          `UPDATE produk SET jumlah_barang = jumlah_barang - $1 WHERE id_produk = $2`,
          [qty, id_produk[i]]
        );
      }

      await db.query("DELETE FROM keranjang WHERE id_produk = $1 AND id_users = $2", [id_produk[i], req.session.userId]);
    }

    res.redirect(`/user/bayar?invoice=${invoiceId}`); // Redirect to the payment details page with the invoice ID
  } catch (err) {
    console.error("Gagal bayar:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat memproses pembayaran" });
  }
});


app.get("/user/bayar", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const invoiceId = req.query.invoice;
  if (!invoiceId) return res.redirect("/");

  try {
    const result = await db.query(`
      SELECT 
        p.id AS pembayaran_id,
        p.metode_pembayaran,
        h.tanggal,
        pr.nama_produk,
        pr.harga
      FROM pembayaran p
      JOIN history_pembelian h ON p.id_history = h.id
      JOIN produk pr ON h.id_produk = pr.id_produk
      WHERE p.id_user = $1 AND h.invoice_id = $2
    `, [req.session.userId, invoiceId]);

    const produkList = result.rows.map(row => ({
      nama_produk: row.nama_produk,
      harga: row.harga
    }));

    const totalBayar = result.rows.reduce((sum, row) => sum + Number(row.harga), 0);

    res.render("user/bayar", {
      produkList,
      totalBayar,
      metode_pembayaran: result[0]?.metode_pembayaran || "-",
      tanggal: result[0]?.tanggal || "",
      invoice: invoiceId
    });
  } catch (err) {
    console.error("Gagal ambil data pembayaran:", err);
    res.status(500).send("Gagal mengambil data pembayaran.");
  }
});



// Menampilkan pesanan
app.get("/user/pesanan", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  try {
    const result = await db.query(
      `SELECT hp.*, p.nama_produk, p.foto, p.harga, hp.alamat
       FROM history_pembelian hp
       JOIN produk p ON hp.id_produk = p.id_produk
       WHERE hp.id_user = $1
       ORDER BY hp.tanggal DESC`,
      [req.session.userId]
    );

    const usersResult = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [req.session.userId]
    );

    const user = usersResult.rows[0];

    const keranjangResult = await db.query(
      "SELECT * FROM keranjang WHERE id_users = $1",
      [req.session.userId]
    );

    let keranjangList = [];
    if (keranjangResult.rows.length > 0) {
      keranjangList = keranjangResult.rows;
    }

    res.render("user/pesanan", {
      pesananList: result.rows,
      users: user,
      keranjangList,
      message: null
    });
  } catch (err) {
    console.error("Error querying pesanan:", err);
    res.status(500).json({ error: "Error while querying pesanan" });
  }
});

// Membatalkan pesanan
app.post("/user/cancel-pesanan/:id_pesanan", async (req, res) => {
  const { id_pesanan } = req.params;

  try {
    // Update status pesanan menjadi dibatalkan
    await db.query(
      `UPDATE history_pembelian
       SET status = 'Dibatalkan'
       WHERE id = $1`,
      [id_pesanan]
    );

    res.redirect("/user/pesanan");
  } catch (err) {
    console.error("Error cancel pesanan:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat membatalkan pesanan" });
  }
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
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0];
    const keranjangResult = await db.query("SELECT * FROM keranjang WHERE id_users = $1", [req.session.userId]);
    let keranjangList = [];
    if (keranjangResult.rows.length > 0) {
      keranjangList = keranjangResult.rows;
    }
    const produkResult = await db.query("SELECT * FROM produk");
    let produkList = [];
    if (produkResult.rows.length > 0) {
      produkList = produkResult.rows;
    }
    res.render("user/landing", {
      users: user,
      message: null,
      keranjangList,
      produkList,
    });
  } catch (err) {
    console.error("Error querying database:", err);
    res.status(500).json({ error: "Error while querying database" });
  }
});
app.get("/users/search", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User  not found" });
    }
    const user = result.rows[0];
    const { search } = req.query;
    const produkResult = await db.query(
      "SELECT * FROM produk WHERE nama_produk ILIKE '%' || $1 || '%' OR kategori ILIKE '%' || $1 || '%' ORDER BY nama_produk ASC",
      [search]
    );
    let produkList = [];
    if (produkResult.rows.length > 0) {
      produkList = produkResult.rows;
    }
    const keranjangResult = await db.query("SELECT * FROM keranjang WHERE id_users = $1", [req.session.userId]);
    let keranjangList = [];
    if (keranjangResult.rows.length > 0) {
      keranjangList = keranjangResult.rows;
    }
    res.render("user/search-produk", {
      users: user,
      message: null,
      produkList,
      keranjangList,
    });
  } catch (err) {
    console.error("Error querying database:", err);
    res.status(500).json({ error: "Error while querying database" });
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

app.get("/keranjang", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  try {
    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const user = userResult.rows[0];

    const keranjangResult = await db.query(`
      SELECT k.id_produk, COUNT(*) AS jumlah, MAX(k.id_keranjang) AS id_keranjang,
             p.nama_produk, p.harga, p.foto
      FROM keranjang k 
      JOIN produk p ON k.id_produk = p.id_produk 
      WHERE k.id_users = $1
      GROUP BY k.id_produk, p.nama_produk, p.harga, p.foto
    `, [req.session.userId]);

    res.render("user/keranjang", { users: user, keranjangList: keranjangResult.rows, message: null });
  } catch (err) {
    console.error("Error querying database:", err);
    res.status(500).json({ error: "Error while querying database" });
  }
});

app.post("/keranjang/hapus/:id_keranjang", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }

  const { id_keranjang } = req.params;
  try {
    await db.query(
      "DELETE FROM keranjang WHERE id_keranjang = $1 AND id_users = $2",
      [id_keranjang, req.session.userId]
    );
    res.redirect("/keranjang");
  } catch (err) {
    console.error("Gagal hapus barang:", err);
    res.status(500).send("Gagal menghapus barang dari keranjang");
  }
});


app.post("/keranjang/tambah/:id_produk", async (req, res) => {
  if (!req.session.userId || req.session.role !== "user") {
    return res.redirect("/login");
  }
  const id_produk = req.params.id_produk;
  try {
    await db.query(
      "INSERT INTO keranjang (id_users, id_produk) VALUES ($1, $2)",
      [req.session.userId, id_produk]
    );
    res.redirect("/keranjang");
  } catch (err) {
    res.status(500).json({ error: "Gagal menambahkan ke keranjang" });
  }
});

app.get("/admin/profil", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.render("admin/profil", {
        users: {},
        message: { type: "error", text: "User tidak ditemukan" }
      });
    }

    res.render("admin/profil", { users: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.render("admin/profil", {
      users: {},
      message: { type: "error", text: "Gagal memuat profil" }
    });
  }
});

app.post("/admin/profil", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const { name, email, password } = req.body;
  let foto = req.files ? req.files.foto : null;

  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    if (result.rows.length === 0) {
      return res.render("admin/profil", {
        users: {},
        message: { type: "error", text: "User tidak ditemukan" }
      });
    }

    const user = result.rows[0];
    let fotoPath = user.foto;
    const updateFields = [];
    const values = [];

    if (name && name !== user.name) {
      updateFields.push("name = $" + (values.length + 1));
      values.push(name);
    }

    if (email && email !== user.email) {
      updateFields.push("email = $" + (values.length + 1));
      values.push(email);
    }

    if (password && password !== user.password) {
      updateFields.push("password = $" + (values.length + 1));
      values.push(password);
    }

    if (foto) {
      const fotoName = Date.now() + "_" + foto.name;
      fotoPath = `/img/${fotoName}`;
      const uploadPath = path.join(__dirname, "public", "img", fotoName);
      await foto.mv(uploadPath);
      updateFields.push("foto = $" + (values.length + 1));
      values.push(fotoPath);
    }

    if (updateFields.length < 2) {
      return res.render("admin/profil", {
        users: user,
        message: { type: "error", text: "Minimal 2 kolom harus diubah." }
      });
    }

    values.push(req.session.userId);
    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${values.length}`;
    await db.query(query, values);

    // Ambil ulang data user terbaru
    const updated = await db.query("SELECT * FROM users WHERE id = $1", [req.session.userId]);
    res.render("admin/profil", {
      users: updated.rows[0],
      message: { type: "success", text: "Profil berhasil diperbarui." }
    });
  } catch (err) {
    console.error("Update error:", err);
    res.render("admin/profil", {
      users: {},
      message: { type: "error", text: err.message || "Gagal memperbarui profil." }
    });
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

