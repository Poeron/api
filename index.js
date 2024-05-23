const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Nodemailer transporter oluşturma
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "carwashappnotification@gmail.com", // Gönderen e-posta adresi
      pass: "exvr bera rhbg jzlq",
    },
});

// MySQL bağlantı bilgileri
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Kullanıcı adınızı buraya girin
    password: '', // Şifrenizi buraya girin
    database: 'car_wash' // Veritabanı adınızı buraya girin
});

// MySQL bağlantısını başlat
db.connect((err) => {
    if (err) {
        console.error('MySQL ile bağlantı sağlanamadı:', err);
    } else {
        console.log('MySQL ile bağlantı başarıyla sağlandı');
    }
});

// Middleware for JSON parsing
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Register endpoint
app.post('/register', (req, res) => {
    const { email, password, phone_number, name, usertype } = req.body;

    // Şifreyi hashle
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası' });
        }

        // Yeni kullanıcıyı veritabanına ekle
        db.query('INSERT INTO users (email, password, phone_number, name, usertype) VALUES (?, ?, ?, ?, ?)', [email, hash, phone_number, name, usertype], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Kayıt oluşturulurken bir hata oluştu' });
            }

            res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi' });
        });
    });
});

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // MySQL sorgusu ile kullanıcıyı bul
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası' });
        }

        // Kullanıcı bulunamadıysa
        if (results.length === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const user = results[0];

        // Şifreyi kontrol et
        bcrypt.compare(password, user.password, (err, result) => {
            if (err || !result) {
                return res.status(401).json({ message: 'Geçersiz e-posta adresi veya şifre.' });
            }

            res.status(200).json({ email: user.email, usertype: user.usertype, id: user.id });
        });
    });
});

// Make Reservation endpoint
app.post('/reservations', (req, res) => {
    let newReservation = {
        user_id: req.body.user_id,
        reservation_date: req.body.reservation_date,
        reservation_time: req.body.reservation_time
    };

    let sql = 'INSERT INTO reservations SET ?';
    db.query(sql, newReservation, (err, result) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(201).send({ id: result.insertId, ...newReservation });
        }
    });
});

// Get reservations by date endpoint
app.get('/home/reservations', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Tarih belirtilmedi.' });
    }

    let sql = 'SELECT reservation_time FROM reservations WHERE reservation_date = ? AND is_accepted = 1';
    db.query(sql, [date], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası', error: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Belirtilen tarihe ait rezervasyon bulunamadı.' });
        }

        // Sadece reservation_time alanlarını içeren yeni bir dizi oluştur
        const reservationTimes = results.map(result => result.reservation_time);

        res.status(200).json(reservationTimes);
    });
});

// Get unaccepted reservations endpoint
app.get('/unaccepted-reservations', (req, res) => {
    let sql = `SELECT r.id, r.reservation_date, r.reservation_time, u.name 
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE r.is_accepted = 0;`;
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası', error: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Kabul edilmemiş rezervasyon bulunamadı.' });
        }

        res.status(200).json(results);
    });
});

// Update reservation to accepted endpoint
app.put('/reservations/:id/accept', (req, res) => {
    const { id } = req.params;

    let sql = 'UPDATE reservations SET is_accepted = 1 WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Belirtilen ID\'ye sahip rezervasyon bulunamadı.' });
        }

        res.status(200).json({ message: 'Rezervasyon başarıyla kabul edildi.' });
    });
});

// Delete reservation endpoint
app.delete('/reservations/:id', (req, res) => {
    const { id } = req.params;

    let sql = 'DELETE FROM reservations WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Belirtilen ID\'ye sahip rezervasyon bulunamadı.' });
        }

        res.status(200).json({ message: 'Rezervasyon başarıyla silindi.' });
    });
});

// Get accepted reservations endpoint
app.get('/accepted-reservations', (req, res) => {
    let sql = `SELECT r.id, r.reservation_date, r.reservation_time, u.name 
    FROM reservations r
    JOIN users u ON r.user_id = u.id
    WHERE r.is_accepted = 1
    ORDER BY reservation_date ASC;`;
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Sunucu hatası', error: err });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Kabul edilmiş rezervasyon bulunamadı.' });
        }

        res.status(200).json(results);
    });
});


// Send email when reservation is created
app.post("/sendEmail", async (req, res) => {
    try {
        const { reservation_id } = req.body;

        // Reservation verilerini al
        db.query(
            "SELECT * FROM reservations WHERE id = ?",
            [reservation_id],
            (err, reservationResult) => {
                if (err) {
                    console.error("Rezervasyon sorgulanırken bir hata oluştu: " + err.message);
                    res.status(500).send("E-posta gönderilirken bir hata oluştu.");
                    return;
                }

                if (reservationResult.length > 0) {
                    const reservationData = reservationResult[0];
                    const userId = reservationData.user_id;

                    // Kullanıcının email adresini al
                    db.query(
                        "SELECT email FROM users WHERE id = ?",
                        [userId],
                        (err, userResult) => {
                            if (err) {
                                console.error("Kullanıcı sorgulanırken bir hata oluştu: " + err.message);
                                res.status(500).send("E-posta gönderilirken bir hata oluştu.");
                                return;
                            }

                            if (userResult.length > 0) {
                                const userEmail = userResult[0].email;

                                // Mail seçeneklerini ayarlayın
                                let mailOptions = {
                                    from: "carwashappnotification@gmail.com", // Gönderen e-posta adresi
                                    to: userEmail, // Alıcı e-posta adresi
                                    subject: "Rezervasyon Oluşturuldu", // E-posta konusu
                                    html: `
                                        <h1>Rezervasyon Detayları</h1>
                                        <p><strong>Rezervasyon ID:</strong> ${reservationData.id}</p>
                                        <p><strong>Kullanıcı ID:</strong> ${reservationData.user_id}</p>
                                        <p><strong>Rezervasyon Tarihi:</strong> ${new Date(reservationData.reservation_date).toLocaleDateString()}</p>
                                        <p><strong>Rezervasyon Saati:</strong> ${reservationData.reservation_time}</p>
                                        <p><strong>Durum:</strong> ${reservationData.is_accepted ? 'Kabul Edildi' : 'Kabul Edilmedi'}</p>
                                    `
                                };

                                // Maili gönderin
                                transporter.sendMail(mailOptions, (error, info) => {
                                    if (error) {
                                        console.error("E-posta gönderilirken bir hata oluştu:", error);
                                        res.status(500).json({ message: "E-posta gönderilirken bir hata oluştu." });
                                    } else {
                                        console.log("E-posta başarıyla gönderildi:", info.response);
                                        res.status(200).json({ message: "E-posta başarıyla gönderildi." });
                                    }
                                });
                            } else {
                                res.status(404).json({ message: "Kullanıcı bulunamadı." });
                            }
                        }
                    );
                } else {
                    res.status(404).json({ message: "Rezervasyon bulunamadı." });
                }
            }
        );
    } catch (error) {
        console.error("E-posta gönderilirken bir hata oluştu:", error);
        res.status(500).json({ message: "E-posta gönderilirken bir hata oluştu." });
    }
});

// Server listen
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
