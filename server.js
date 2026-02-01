require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- CLOUDINARY ---------------- */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ---------------- STORAGE ---------------- */

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const customId = req.body.customId;
        let publicId;

        if (customId && customId.trim()) {
            const safeSlug = customId
                .replace(/[^a-zA-Z0-9]/g, "")
                .substring(0, 30);
            publicId = `vise-${safeSlug}`;
        } else {
            publicId = uuidv4();
        }

        return {
            folder: 'vise_uploads',
            public_id: publicId,
            format: 'png'
        };
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('viseImage');

/* ---------------- APP CONFIG ---------------- */

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

/* ---------------- ROUTES ---------------- */

// 1. Health Check (New Feature for the Green Dot)
app.get('/health', (req, res) => {
    res.json({ status: 'online' });
});

// 2. Home Page
app.get('/', (req, res) => {
    res.render('index', { error: null });
});

// 3. Image Page
app.get('/v/:id', (req, res) => {
    const fileId = req.params.id;

    const imageUrl = cloudinary.url(`vise_uploads/${fileId}`, {
        secure: true,
        transformation: [
            { quality: 'auto', fetch_format: 'auto' }
        ]
    });

    res.render('image', {
        file: fileId,
        url: imageUrl,
        error: null
    });
});

// 4. Upload Route (Updated for AJAX Support)
app.post('/upload', (req, res) => {
    upload(req, res, err => {
        // Handle Errors
        if (err) {
            const errorMsg = err.message || 'Upload Error';
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
                return res.status(500).json({ error: errorMsg });
            }
            return res.render('index', { error: errorMsg });
        }

        if (!req.file) {
            const errorMsg = 'No File Selected';
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
                return res.status(400).json({ error: errorMsg });
            }
            return res.render('index', { error: errorMsg });
        }

        // Success Logic
        const fullPublicId = req.file.filename;
        const shortId = fullPublicId.split('/').pop();
        const redirectUrl = `/v/${shortId}`;

        // Return JSON for the new frontend (AJAX), otherwise standard redirect
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.json({ redirect: redirectUrl });
        }

        res.redirect(redirectUrl);
    });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
    console.log(`VISE server running on port ${PORT}`);
});
