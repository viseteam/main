require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- CLOUDINARY CONFIG ---------------- */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/* ---------------- HELPER: ID GENERATOR ---------------- */

// Generates ID like: vise-customname_by_username
const generatePublicId = (req) => {
    const customId = req.body.customId;
    const username = req.body.username;
    
    // Base Name
    let baseName = (customId && customId.trim()) 
        ? `vise-${customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30)}` 
        : uuidv4();

    // Append Username if exists (sanitize it!)
    if (username && username.trim()) {
        const cleanUser = username.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);
        baseName += `_by_${cleanUser}`;
    }

    return baseName;
};

/* ---------------- STORAGE ENGINES ---------------- */

const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'vise_uploads',
        public_id: generatePublicId(req),
        format: 'png'
    })
});

const htmlStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'vise_static',
        public_id: generatePublicId(req),
        resource_type: 'raw',
        format: 'html'
    })
});

const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } }).single('viseImage');
const uploadHtml = multer({ storage: htmlStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single('viseHtml');

/* ---------------- APP CONFIG ---------------- */

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

/* ---------------- ROUTES ---------------- */

app.get('/health', (req, res) => res.json({ status: 'online' }));
app.get('/', (req, res) => res.render('index', { error: null }));

// 3. View Image Page (Updated for Metadata)
app.get('/v/:id', (req, res) => {
    const fileId = req.params.id;
    
    // Extract Username from ID (vise-name_by_dill)
    let displayUser = 'Anonymous';
    let cleanName = fileId;

    if (fileId.includes('_by_')) {
        const parts = fileId.split('_by_');
        cleanName = parts[0]; // The 'vise-name' part
        displayUser = parts[1]; // The 'dill' part
    }

    const imageUrl = cloudinary.url(`vise_uploads/${fileId}`, {
        secure: true, 
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    });

    res.render('image', { 
        rawId: fileId,
        cleanName: cleanName,
        user: displayUser,
        url: imageUrl, 
        error: null 
    });
});

// 4. Serve Static HTML
app.get('/static/:id.html', async (req, res) => {
    try {
        const fileId = req.params.id;
        const rawUrl = cloudinary.url(`vise_static/${fileId}.html`, { resource_type: 'raw', secure: true });
        const response = await axios.get(rawUrl);
        res.set('Content-Type', 'text/html');
        res.send(response.data);
    } catch (err) {
        res.status(404).send('File not found.');
    }
});

/* ---------------- UPLOAD HANDLERS ---------------- */

const handleUpload = (req, res, type) => {
    const fullPublicId = req.file.filename; 
    const shortId = fullPublicId.split('/').pop().replace('.html', ''); 
    
    const redirectUrl = (type === 'image') ? `/v/${shortId}` : `/static/${shortId}.html`;

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.json({ redirect: redirectUrl });
    }
    res.redirect(redirectUrl);
};

app.post('/upload/image', (req, res) => {
    uploadImage(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No File Selected' });
        handleUpload(req, res, 'image');
    });
});

app.post('/upload/html', (req, res) => {
    uploadHtml(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No File Selected' });
        handleUpload(req, res, 'html');
    });
});

app.listen(PORT, () => console.log(`VISE server running on ${PORT}`));
