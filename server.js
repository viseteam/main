require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Setup Cloudinary Storage Engine
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const customId = req.body.customId;
        let publicId;

        // Custom Name Logic
        if (customId && customId.trim().length > 0) {
            const safeSlug = customId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
            publicId = `vise-${safeSlug}`; 
        } else {
            // Random Name
            publicId = uuidv4();
        }

        return {
            folder: 'vise_uploads', // The folder in your Cloudinary dashboard
            public_id: publicId,
            format: 'png', // Force convert to PNG (optional, or remove to keep original)
        };
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB Limit
}).single('viseImage');

app.set('view engine', 'ejs');
app.use(express.static('public'));

// --- ROUTES ---

// 1. Home Page
app.get('/', (req, res) => res.render('index', { error: null }));

// 2. The "File Page" (Wrapper)
// Now constructs the URL using Cloudinary data
app.get('/v/:id', async (req, res) => {
    const fileId = req.params.id;
    
    // Construct the direct Cloudinary URL
    // Format: https://res.cloudinary.com/<cloud_name>/image/upload/<folder>/<id>
    const imageUrl = cloudinary.url(`vise_uploads/${fileId}`, {
        secure: true,
        transformation: [
            { quality: "auto", fetch_format: "auto" } // Optimization
        ]
    });

    res.render('image', { 
        file: fileId,
        url: imageUrl 
    });
});

// 3. Upload & Redirect
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.render('index', { error: err.message || 'Upload Error' });
        if (!req.file) return res.render('index', { error: 'No File Selected' });

        // req.file.filename in Cloudinary storage is the Public ID (e.g., "vise_uploads/vise-cool")
        // We just want the last part for our clean URL
        const fullPublicId = req.file.filename; 
        const shortId = fullPublicId.split('/').pop(); 

        res.redirect(`/v/${shortId}`);
    });
});

app.listen(PORT, () => console.log(`VISE server running on port ${PORT}`));
