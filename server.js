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

/* ---------------- STORAGE ENGINES ---------------- */

// 1. IMAGE STORAGE (Converts to PNG)
const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const customId = req.body.customId;
        let publicId;

        if (customId && customId.trim()) {
            const safeSlug = customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
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

// 2. HTML STORAGE (Raw File)
const htmlStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const customId = req.body.customId;
        let publicId;

        if (customId && customId.trim()) {
            const safeSlug = customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
            publicId = `vise-${safeSlug}`;
        } else {
            publicId = uuidv4();
        }

        return {
            folder: 'vise_static',
            public_id: publicId,
            resource_type: 'raw', // Important for HTML
            format: 'html'
        };
    }
});

const uploadImage = multer({ 
    storage: imageStorage, 
    limits: { fileSize: 10 * 1024 * 1024 } 
}).single('viseImage');

const uploadHtml = multer({ 
    storage: htmlStorage, 
    limits: { fileSize: 5 * 1024 * 1024 } 
}).single('viseHtml');

/* ---------------- APP CONFIG ---------------- */

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

/* ---------------- ROUTES ---------------- */

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'online' });
});

// 2. Home Page
app.get('/', (req, res) => {
    res.render('index', { error: null });
});

// 3. View Image Page
app.get('/v/:id', (req, res) => {
    const fileId = req.params.id;
    const imageUrl = cloudinary.url(`vise_uploads/${fileId}`, {
        secure: true, 
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
    });

    res.render('image', { 
        file: fileId, 
        url: imageUrl, 
        error: null 
    });
});

// 4. Serve Static HTML (Proxy)
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

/* ---------------- UPLOAD LOGIC ---------------- */

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

    // Return JSON for AJAX frontend
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.json({ redirect: redirectUrl });
    }
    res.redirect(redirectUrl);
};

// Image Upload Endpoint
app.post('/upload/image', (req, res) => {
    uploadImage(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'No File Selected' });
        handleUploadResponse(req, res, 'image');
    });
});

// HTML Upload Endpoint
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
