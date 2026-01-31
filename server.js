const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Storage
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        // Randomize filename
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        if(mimetype) return cb(null, true);
        cb('Error: Images Only');
    }
}).single('viseImage');

// View Engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    // FIX: We must pass 'error' explicitly, even if it is null
    res.render('index', { link: null, error: null });
});

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            // FIX: Pass 'error' here too
            return res.render('index', { link: null, error: err });
        }
        if(!req.file) {
            // FIX: Pass 'error' here too
            return res.render('index', { link: null, error: 'No File Selected' });
        }

        const fullUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.render('index', { link: fullUrl, error: null });
    });
});

app.listen(PORT, () => console.log(`VISE server running on port ${PORT}`));
