const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

app = app.replaceAll("navToPage('timeline')", "navToPage('roteiros')");

fs.writeFileSync('public/js/app.js', app);
