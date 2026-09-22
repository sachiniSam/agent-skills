const express = require('express');
const app = express();
app.use(express.json());
const orders = [{ id: 1, item: 'Widget', qty: 2 }];
app.get('/orders', (req, res) => res.json(orders));
app.post('/orders', (req, res) => { const o = { id: orders.length + 1, ...req.body }; orders.push(o); res.status(201).json(o); });
app.delete('/orders/:id', (req, res) => { const i = orders.findIndex(o => o.id === Number(req.params.id)); if (i < 0) return res.sendStatus(404); orders.splice(i, 1); res.sendStatus(204); });
app.listen(4000, () => console.log('orders api on http://localhost:4000'));
