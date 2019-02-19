const express = require('express');

const PORT = 8080,
    app = express();

app.set('view engine', 'pug');

app.use('/', require('./routes/index'));
app.use('/resources', express.static('./resources'));

app.listen(PORT, console.log(`Listening on port ${PORT}`));