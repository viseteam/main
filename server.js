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
// Used by both Image and HTML storage engines
const generatePublicId = (req) => {
    const customId = req.body.customId;
    const username = req.body.username;
    
    // 1. Create Base Name (Custom or Random)
    let baseName;
    if (customId && customId.trim()) {
        // Sanitize: Only alphanumeric, max 30 chars
        const safeSlug = customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
        baseName = `vise-${safeSlug}`;
    } else {
        baseName = uuidv4();
    }

    // 2. Append Username if exists (sanitize it!)
    if (username && username.trim()) {
        const cleanUser = username.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);
        baseName += `_by_${cleanUser}`;
    }

    return baseName;
};

/* ---------------- STORAGE ENGINES ---------------- */

// 1. Image Storage (Converts to PNG)
const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'vise_uploads',
        public_id: generatePublicId(req),
        format: 'png'
    })
});

// 2. HTML Storage (Raw File)
const htmlStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: 'vise_static',
        public_id: generatePublicId(req),
        resource_type: 'raw', // Critical for HTML files
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

// 1. Health Check
app.get('/health', (req, res) => res.json({ status: 'online' }));

// 2. Editor Page (The VS Code Style Editor)
app.get('/editor', (req, res) => res.render('editor'));

// 3. Home Page
app.get('/', (req, res) => res.render('index', { error: null }));

// 4. View Image Page (Parses Metadata from ID)
app.get('/v/:id', (req, res) => {
    const fileId = req.params.id;
    
    // Logic: Extract Username from ID (vise-name_by_dill)
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

// 5. Serve Static HTML (Proxy to Cloudinary)
app.get('/static/:id.html', async (req, res) => {
    try {
        const fileId = req.params.id;
        // Construct the raw Cloudinary URL
        const rawUrl = cloudinary.url(`vise_static/${fileId}.html`, { 
            resource_type: 'raw', 
            secure: true 
        });

        // Fetch content and serve
        const response = await axios.get(rawUrl);
        res.set('Content-Type', 'text/html');
        res.send(response.data);
    } catch (err) {
        res.status(404).send('File not found or deleted.');
    }
});

/* ---------------- UPLOAD HANDLERS ---------------- */

const handleUploadResponse = (req, res, type) => {
    const fullPublicId = req.file.filename; 
    // Remove folder path and extension to get the ID
    const shortId = fullPublicId.split('/').pop().replace('.html', ''); 

    let redirectUrl;
    if (type === 'image') {
        redirectUrl = `/v/${shortId}`;
    } else {
        redirectUrl = `/static/${shortId}.html`;
    }

    // Return JSON for AJAX frontend (Works for both Index and Editor)
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.json({ redirect: redirectUrl });
    }
    res.redirect(redirectUrl);
};

// POST: Upload Image
app.post('/upload/image', (req, res) => {
    uploadImage(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No File Selected' });
        handleUploadResponse(req, res, 'image');
    });
});

// POST: Upload HTML
app.post('/upload/html', (req, res) => {
    uploadHtml(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No File Selected' });
        handleUploadResponse(req, res, 'html');
    });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
    console.log(`VISE server running on port ${PORT}`);
});
