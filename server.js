const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if(mimetype && extname) return cb(null, true);
        cb('Error: Images Only!');
    }
}).single('viseImage');
app.set('view engine', 'ejs');
app.use(express.static('./public'));
app.get('/', (req, res) => res.render('index', { link: null, msg: null }));
app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err) {
            return res.render('index', { msg: err, link: null });
        }
        if(req.file == undefined) {
            return res.render('index', { msg: 'No file selected', link: null });
        }
        // Success: Send back the full URL
        const fullUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.render('index', {
            msg: null,
            link: fullUrl
        });
    });
});
app.listen(PORT, () => console.log(`VISE running on ${PORT}`));
