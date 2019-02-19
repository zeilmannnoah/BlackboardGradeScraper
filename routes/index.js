const express = require('express'),
    Index = require('../controllers/Index');

const index = express.Router(),
    ctrl = new Index();

index.get('/grades', (...args) => ctrl.grades(...args));

module.exports = index;