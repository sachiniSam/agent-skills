import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const orders = [{ id: 1, item: 'Widget', qty: 2 }];
const mcp = new McpServer({ name: 'orders', version: '1.0.0' });
mcp.tool('list_orders', 'List all orders', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(orders) }] }));
mcp.tool('create_order', 'Create an order', { item: z.string(), qty: z.number() }, async ({ item, qty }) => {
  const o = { id: orders.length + 1, item, qty }; orders.push(o);
  return { content: [{ type: 'text', text: JSON.stringify(o) }] };
});

const app = express();
app.use(express.json());
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await mcp.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
app.listen(3000, () => console.log('MCP server on http://localhost:3000/mcp'));
