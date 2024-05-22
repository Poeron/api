const express = require('express');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const PORT = process.env.PORT || 3000;

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

            res.status(200).json({ email: user.email, usertype: user.usertype, id: user.id});
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
    ORDER BY reservation_date ASC;`
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

// Server listen
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});
