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
        const customId = req.body.customId;
        let finalName;
        // Logic for custom vise- name
        if(customId && customId.trim().length > 0) {
            const safeSlug = customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
            finalName = `vise-${safeSlug}${path.extname(file.originalname)}`;
        } else {
            finalName = uuidv4() + path.extname(file.originalname);
        }
        cb(null, finalName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        if(filetypes.test(file.mimetype)) return cb(null, true);
        cb('images / gifs only');
    }
}).single('viseImage');

app.set('view engine', 'ejs');
app.use(express.static('public'));

// 1. Home Page
app.get('/', (req, res) => res.render('index', { error: null }));

// 2. The "File Page" (Wrapper with Metadata)
app.get('/v/:filename', (req, res) => {
    const fileName = req.params.filename;
    const filePath = path.join(uploadDir, fileName);

    // Security check to prevent directory traversal
    if (fileName.indexOf('..') !== -1 || !fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }

    res.render('image', { 
        file: fileName,
        url: `${req.protocol}://${req.get('host')}/uploads/${fileName}`
    });
});

// 3. Upload & Redirect
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err) return res.render('index', { error: err });
        if(!req.file) return res.render('index', { error: 'No File Selected' });

        // Redirect to the wrapper page (opens in new tab per form attribute)
        res.redirect(`/v/${req.file.filename}`);
    });
});

app.listen(PORT, () => console.log(`VISE server running on port ${PORT}`));
