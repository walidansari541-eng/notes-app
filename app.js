const express = require('express');
const notesRoutes = require('./src/routes');

const app = express();
app.use(express.json());


app.use('/api', notesRoutes);
module.exports = app;


