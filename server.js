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
        // req.body is available here ONLY if the text input comes BEFORE the file input in the HTML form
        const customId = req.body.customId;
        
        let finalName;
        if(customId && customId.trim().length > 0) {
            // Sanitize: Allow only letters/numbers, max 30 chars
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
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        if(filetypes.test(file.mimetype)) return cb(null, true);
        cb('Error: Images Only');
    }
}).single('viseImage');

app.set('view engine', 'ejs');
app.use(express.static('public'));

// GET: Render Page
app.get('/', (req, res) => res.render('index', { error: null }));

// POST: Upload & Redirect
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err) return res.render('index', { error: err });
        if(!req.file) return res.render('index', { error: 'No File Selected' });

        // Redirect directly to the image
        res.redirect(`/uploads/${req.file.filename}`);
    });
});

app.listen(PORT, () => console.log(`VISE server running on port ${PORT}`));
