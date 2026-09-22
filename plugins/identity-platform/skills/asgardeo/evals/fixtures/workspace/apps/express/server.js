const express = require('express');
const session = require('express-session');
const app = express();
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-only', resave: false, saveUninitialized: false }));
app.get('/', (req, res) => res.send('<h1>Orders</h1><a href="/login">Sign in</a>'));
app.get('/orders', (req, res) => res.json([{ id: 1, item: 'Widget' }]));
app.listen(3000, () => console.log('http://localhost:3000'));
