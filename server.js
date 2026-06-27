const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'demo_school_class_secret_change_me';
const SALT_ROUNDS = 10;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and WEBP images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

function validateCredentials(email, password) {
  return (
    typeof email === 'string' &&
    typeof password === 'string' &&
    email.trim().length > 0 &&
    password.length >= 6
  );
}

// Middleware that rejects missing, malformed, expired, or invalid JWTs.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token is required.' });
  }

  jwt.verify(token, JWT_SECRET, (error, user) => {
    if (error) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.user = user;
    next();
  });
}

// Middleware that checks if user has required role
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      db.get(
        'SELECT role FROM users WHERE id = ?',
        [req.user.id],
        (error, user) => {
          if (error) {
            return res.status(500).json({ message: 'Could not verify permissions.' });
          }

          if (!user) {
            return res.status(404).json({ message: 'User not found.' });
          }

          const userRole = user.role || 'user';
          if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: 'Insufficient permissions.' });
          }

          req.userRole = userRole;
          next();
        }
      );
    } catch (error) {
      return res.status(500).json({ message: 'Could not verify permissions.' });
    }
  };
}

app.post('/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  if (!validateCredentials(email, password)) {
    return res.status(400).json({
      message: 'Please enter a valid email and a password with at least 6 characters.'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    db.run(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, hashedPassword],
      function insertUser(error) {
        if (error) {
          if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
          }

          return res.status(500).json({ message: 'Could not create account.' });
        }

        return res.status(201).json({
          message: 'Registration successful.',
          user: {
            id: this.lastID,
            email
          }
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ message: 'Password hashing failed.' });
  }
});

app.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;

  if (!validateCredentials(email, password)) {
    return res.status(400).json({
      message: 'Please enter a valid email and password.'
    });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (error, user) => {
    if (error) {
      return res.status(500).json({ message: 'Could not log in.' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({
      message: 'Login successful.',
      token
    });
  });
});

app.get('/profile', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, email, nickname, avatar, birthDate, theme, role, created_at FROM users WHERE id = ?',
    [req.user.id],
    (error, user) => {
      if (error) {
        return res.status(500).json({ message: 'Could not load profile.' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.json({ user });
    }
  );
});

app.get('/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, email, nickname, avatar, birthDate, theme, role, created_at FROM users WHERE id = ?',
    [req.user.id],
    (error, user) => {
      if (error) {
        return res.status(500).json({ message: 'Could not load user data.' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.json({
        user: {
          ...user,
          nickname: user.nickname || '',
          avatar: user.avatar || '',
          birthDate: user.birthDate || '',
          theme: user.theme || 'blue',
          role: user.role || 'student'
        }
      });
    }
  );
});

app.post('/update-profile', authenticateToken, (req, res) => {
  const nickname = String(req.body.nickname || '').trim().slice(0, 40);
  const avatar = String(req.body.avatar || '').trim().slice(0, 200000);
  const birthDate = String(req.body.birthDate || '').trim();

  if (avatar && !isValidAvatarValue(avatar)) {
    return res.status(400).json({ message: 'Invalid avatar.' });
  }

  if (birthDate && !isValidCosmeticBirthDate(birthDate)) {
    return res.status(400).json({ message: 'Invalid birth date.' });
  }

  db.run(
    'UPDATE users SET nickname = ?, avatar = ?, birthDate = ? WHERE id = ?',
    [nickname, avatar, birthDate, req.user.id],
    (error) => {
      if (error) {
        return res.status(500).json({ message: 'Could not update profile.' });
      }

      return res.json({
        message: 'Profile updated.',
        user: {
          id: req.user.id,
          email: req.user.email,
          nickname,
          avatar,
          birthDate
        }
      });
    }
  );
});

app.get('/news', authenticateToken, (req, res) => {
  db.get(
    'SELECT role FROM users WHERE id = ?',
    [req.user.id],
    (error, user) => {
      if (error) {
        return res.status(500).json({ message: 'Could not verify permissions.' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const userRole = user.role || 'user';
      let query = 'SELECT id, title, description, media, isImportant, status, createdBy, created_at FROM news ORDER BY created_at DESC';
      let params = [];

      if (userRole === 'user') {
        query = 'SELECT id, title, description, media, isImportant, status, createdBy, created_at FROM news WHERE status = ? ORDER BY created_at DESC';
        params = ['approved'];
      } else if (userRole === 'reporter') {
        query = 'SELECT id, title, description, media, isImportant, status, createdBy, created_at FROM news WHERE status = ? OR createdBy = ? ORDER BY created_at DESC';
        params = ['approved', req.user.id];
      }

      db.all(query, params, (error, rows) => {
        if (error) {
          return res.status(500).json({ message: 'Could not load news.' });
        }

        return res.json({ news: rows || [] });
      });
    }
  );
});

app.post('/upload', authenticateToken, requireRole(['owner', 'reporter']), upload.single('image'), (req, res) => {
  console.log('POST /upload request from user:', req.user.id, req.user.email);
  console.log('File received:', req.file);

  if (!req.file) {
    console.log('Error: No file uploaded');
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  console.log('Image uploaded successfully:', imageUrl);

  return res.json({
    message: 'Image uploaded successfully.',
    imageUrl
  });
});

app.post('/news', authenticateToken, requireRole(['owner', 'reporter']), (req, res) => {
  console.log('POST /news request from user:', req.user.id, req.user.email);
  console.log('Request body:', req.body);

  const title = String(req.body.title || '').trim().slice(0, 200);
  const description = String(req.body.description || '').trim().slice(0, 10000);
  const media = String(req.body.media || '').trim().slice(0, 500);
  const isImportant = req.body.isImportant ? 1 : 0;

  console.log('Parsed data - title:', title, 'description length:', description.length, 'media:', media, 'isImportant:', isImportant);

  if (!title) {
    console.log('Error: Title is required');
    return res.status(400).json({ message: 'Title is required.' });
  }

  if (!description) {
    console.log('Error: Description is required');
    return res.status(400).json({ message: 'Description is required.' });
  }

  db.run(
    'INSERT INTO news (title, description, media, isImportant, status, createdBy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    [title, description, media, isImportant, 'pending', req.user.id],
    function (error) {
      if (error) {
        console.error('Database error creating news:', error.message);
        return res.status(500).json({ message: 'Could not create news: ' + error.message });
      }

      console.log('News created successfully with ID:', this.lastID);
      return res.json({
        message: 'News created successfully.',
        news: {
          id: this.lastID,
          title,
          description,
          media,
          isImportant,
          status: 'pending',
          createdBy: req.user.id
        }
      });
    }
  );
});

app.post('/news/:id/status', authenticateToken, requireRole(['owner', 'moderator']), (req, res) => {
  const newsId = Number.parseInt(req.params.id, 10);
  const status = String(req.body.status || '').trim().toLowerCase();
  const allowedStatuses = ['approved', 'rejected'];

  if (!Number.isInteger(newsId) || newsId <= 0) {
    return res.status(400).json({ message: 'Invalid news id.' });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  db.run(
    'UPDATE news SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, newsId],
    (error) => {
      if (error) {
        return res.status(500).json({ message: 'Could not update news status.' });
      }

      return res.json({
        message: `News ${status} successfully.`,
        news: {
          id: newsId,
          status
        }
      });
    }
  );
});

app.delete('/news/:id', authenticateToken, (req, res) => {
  const newsId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(newsId) || newsId <= 0) {
    return res.status(400).json({ message: 'Invalid news id.' });
  }

  db.get(
    'SELECT role FROM users WHERE id = ?',
    [req.user.id],
    (error, user) => {
      if (error) {
        return res.status(500).json({ message: 'Could not verify permissions.' });
      }

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const userRole = user.role || 'user';

      if (userRole === 'owner' || userRole === 'moderator') {
        db.run('DELETE FROM news WHERE id = ?', [newsId], (error) => {
          if (error) {
            return res.status(500).json({ message: 'Could not delete news.' });
          }

          return res.json({
            message: 'News deleted successfully.',
            news: {
              id: newsId
            }
          });
        });
      } else if (userRole === 'reporter') {
        db.get('SELECT createdBy, status FROM news WHERE id = ?', [newsId], (error, news) => {
          if (error) {
            return res.status(500).json({ message: 'Could not load news.' });
          }

          if (!news) {
            return res.status(404).json({ message: 'News not found.' });
          }

          if (news.createdBy !== req.user.id || news.status === 'approved') {
            return res.status(403).json({ message: 'You can only delete your own unpublished news.' });
          }

          db.run('DELETE FROM news WHERE id = ?', [newsId], (error) => {
            if (error) {
              return res.status(500).json({ message: 'Could not delete news.' });
            }

            return res.json({
              message: 'News deleted successfully.',
              news: {
                id: newsId
              }
            });
          });
        });
      } else {
        return res.status(403).json({ message: 'Insufficient permissions.' });
      }
    }
  );
});

app.get('/news/:id', authenticateToken, (req, res) => {
  const newsId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(newsId) || newsId <= 0) {
    return res.status(400).json({ message: 'Invalid news id.' });
  }

  db.get(
    'SELECT id, title, preview, body, is_announcement, created_at FROM news WHERE id = ?',
    [newsId],
    (error, row) => {
      if (error) {
        return res.status(500).json({ message: 'Could not load news item.' });
      }

      if (!row) {
        return res.status(404).json({ message: 'News item not found.' });
      }

      return res.json({ news: row });
    }
  );
});

app.post('/update-settings', authenticateToken, (req, res) => {
  const theme = String(req.body.theme || 'blue').trim().toLowerCase();
  const allowedThemes = ['blue', 'purple', 'green'];

  if (!allowedThemes.includes(theme)) {
    return res.status(400).json({ message: 'Invalid theme.' });
  }

  db.run(
    'UPDATE users SET theme = ? WHERE id = ?',
    [theme, req.user.id],
    (error) => {
      if (error) {
        return res.status(500).json({ message: 'Could not update settings.' });
      }

      return res.json({
        message: 'Settings updated.',
        user: {
          id: req.user.id,
          email: req.user.email,
          theme
        }
      });
    }
  );
});

app.get('/users', authenticateToken, requireRole(['owner']), (req, res) => {
  db.all(
    'SELECT id, email, nickname, avatar, role, created_at FROM users ORDER BY created_at DESC',
    (error, users) => {
      if (error) {
        return res.status(500).json({ message: 'Could not load users.' });
      }

      return res.json({ users: users || [] });
    }
  );
});

app.post('/users/:id/role', authenticateToken, requireRole(['owner']), (req, res) => {
  const targetUserId = Number.parseInt(req.params.id, 10);
  const newRole = String(req.body.role || '').trim().toLowerCase();
  const allowedRoles = ['user', 'moderator', 'reporter', 'owner'];

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  if (!allowedRoles.includes(newRole)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  if (targetUserId === req.user.id) {
    return res.status(400).json({ message: 'Cannot change your own role.' });
  }

  db.run(
    'UPDATE users SET role = ? WHERE id = ?',
    [newRole, targetUserId],
    (error) => {
      if (error) {
        return res.status(500).json({ message: 'Could not update user role.' });
      }

      return res.json({
        message: 'User role updated.',
        user: {
          id: targetUserId,
          role: newRole
        }
      });
    }
  );
});

function isValidCosmeticBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return value >= '2000-01-01' && value <= '2025-12-31';
}

function isValidAvatarValue(value) {
  if (value.length > 200000) {
    return false;
  }

  if (value.startsWith('data:image/')) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

app.listen(PORT, () => {
  console.log(`School class website running at http://localhost:${PORT}`);
});
