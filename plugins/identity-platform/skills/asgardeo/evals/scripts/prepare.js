#!/usr/bin/env node
/**
 * Build the fixture workspace for the asgardeo eval suite. Nothing under
 * fixtures/ is committed; `npm run eval` runs this first, so a fresh clone
 * works with no extra step.
 *
 *   node scripts/prepare.js
 *
 * Steps:
 *   1. copy the live skill into fixtures/workspace/.claude/skills/asgardeo
 *      (the repo's tools/sync-fixtures.js)
 *   2. write the sample apps the scenarios edit (one per SDK framework, plus
 *      the API, MCP server and agent used by tracks B, E and F)
 *   3. install the stub CLI (../stub/asg.js) as fixtures/workspace/bin/asg
 *   4. capture `--help` for every command of the developer's installed `asg`
 *      into bin/asg-help/, so the stub serves real, current help text and
 *      rejects flags the real CLI does not define
 *
 * Node builtins only. Requires the real `asg` on PATH (or ASG_BIN=<path>).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const EVALS = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EVALS, '..', '..', '..', '..', '..');
const WS = path.join(EVALS, 'fixtures', 'workspace');
const APPS = path.join(WS, 'apps');
const BIN = path.join(WS, 'bin');
const HELP = path.join(BIN, 'asg-help');

function fail(msg) { console.error(`error: ${msg}`); process.exit(1); }
function write(rel, content) {
  const p = path.join(APPS, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/^\n/, ''));
}

// ---- 1. skill copy --------------------------------------------------------
// sync-fixtures.js refreshes layouts that exist, so create the Claude layout first.
fs.mkdirSync(path.join(WS, '.claude', 'skills', 'asgardeo'), { recursive: true });
const sync = spawnSync('node', [path.join(REPO_ROOT, 'tools', 'sync-fixtures.js'), 'identity-platform', 'asgardeo'], { stdio: 'inherit' });
if (sync.status !== 0) fail('tools/sync-fixtures.js failed (is this checkout on a branch that has tools/?)');

// ---- 2. sample apps -------------------------------------------------------
fs.rmSync(APPS, { recursive: true, force: true });
fs.rmSync(path.join(WS, '.asg-stub'), { recursive: true, force: true });

const VITE_INDEX = (entry) => `<!doctype html><html><head><title>Orders</title></head><body><div id="root"></div><script type="module" src="${entry}"></script></body></html>\n`;

// React (Vite)
write('react-vite/package.json', `
{
  "name": "orders-web",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "tsc -b && vite build" },
  "dependencies": { "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": { "@types/react": "^19.1.0", "@types/react-dom": "^19.1.0", "@vitejs/plugin-react": "^4.5.0", "typescript": "~5.8.3", "vite": "^6.3.5" }
}
`);
write('react-vite/vite.config.ts', `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], server: { port: 5173 } })
`);
write('react-vite/index.html', VITE_INDEX('/src/main.tsx'));
write('react-vite/src/main.tsx', `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
`);
write('react-vite/src/App.tsx', `
export default function App() {
  return (
    <main>
      <h1>Orders</h1>
      <p>Welcome. Sign in to see your orders.</p>
    </main>
  )
}
`);

// Next.js (App Router)
write('nextjs/package.json', `
{
  "name": "orders-portal",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": { "next": "15.3.2", "react": "^19.1.0", "react-dom": "^19.1.0" },
  "devDependencies": { "@types/node": "^22", "@types/react": "^19", "typescript": "^5" }
}
`);
write('nextjs/app/layout.tsx', `
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
`);
write('nextjs/app/page.tsx', `
export default function Home() {
  return <main><h1>Orders portal</h1><p>Sign in to continue.</p></main>
}
`);

// Vue 3
write('vue/package.json', `
{
  "name": "orders-vue",
  "private": true,
  "type": "module",
  "scripts": { "dev": "vite", "build": "vue-tsc -b && vite build" },
  "dependencies": { "vue": "^3.5.13" },
  "devDependencies": { "@vitejs/plugin-vue": "^5.2.3", "typescript": "~5.8.0", "vite": "^6.3.5", "vue-tsc": "^2.2.8" }
}
`);
write('vue/index.html', VITE_INDEX('/src/main.ts').replace('id="root"', 'id="app"'));
write('vue/src/main.ts', `
import { createApp } from 'vue'
import App from './App.vue'
createApp(App).mount('#app')
`);
write('vue/src/App.vue', `
<script setup lang="ts"></script>
<template>
  <main><h1>Orders</h1><p>Sign in to see your orders.</p></main>
</template>
`);

// Angular
write('angular/package.json', `
{
  "name": "orders-angular",
  "private": true,
  "scripts": { "start": "ng serve", "build": "ng build" },
  "dependencies": { "@angular/common": "^19.2.0", "@angular/core": "^19.2.0", "@angular/platform-browser": "^19.2.0", "@angular/router": "^19.2.0", "rxjs": "~7.8.0", "zone.js": "~0.15.0" },
  "devDependencies": { "@angular/cli": "^19.2.0", "@angular/compiler-cli": "^19.2.0", "typescript": "~5.7.2" }
}
`);
write('angular/src/main.ts', `
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
bootstrapApplication(AppComponent).catch((err) => console.error(err));
`);
write('angular/src/app/app.component.ts', `
import { Component } from '@angular/core';
@Component({ selector: 'app-root', standalone: true, template: \`<main><h1>Orders</h1><p>Sign in to see your orders.</p></main>\` })
export class AppComponent {}
`);

// Nuxt 3 (client-side)
write('nuxt/package.json', `
{
  "name": "orders-nuxt",
  "private": true,
  "type": "module",
  "scripts": { "dev": "nuxt dev", "build": "nuxt build" },
  "dependencies": { "nuxt": "^3.17.0", "vue": "^3.5.13" }
}
`);
write('nuxt/nuxt.config.ts', `
export default defineNuxtConfig({ compatibilityDate: '2025-05-15', devtools: { enabled: false }, ssr: false })
`);
write('nuxt/app.vue', `
<template>
  <main><h1>Orders</h1><p>Sign in to see your orders.</p></main>
</template>
`);

// Vanilla JS
write('vanilla-js/package.json', `
{ "name": "orders-static", "private": true, "type": "module", "scripts": { "dev": "vite" }, "devDependencies": { "vite": "^6.3.5" } }
`);
write('vanilla-js/index.html', `
<!doctype html><html><head><title>Orders</title></head><body>
<main><h1>Orders</h1><button id="login">Sign in</button><button id="logout" hidden>Sign out</button><pre id="user"></pre></main>
<script type="module" src="/main.js"></script></body></html>
`);
write('vanilla-js/main.js', `
document.getElementById('login').addEventListener('click', () => { /* TODO: sign in */ });
document.getElementById('logout').addEventListener('click', () => { /* TODO: sign out */ });
`);

// Spring Boot
write('spring-boot/pom.xml', `
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.4.5</version></parent>
  <groupId>com.example</groupId><artifactId>orders</artifactId><version>0.0.1-SNAPSHOT</version>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-thymeleaf</artifactId></dependency>
  </dependencies>
</project>
`);
write('spring-boot/src/main/java/com/example/orders/OrdersApplication.java', `
package com.example.orders;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class OrdersApplication { public static void main(String[] args) { SpringApplication.run(OrdersApplication.class, args); } }
`);
write('spring-boot/src/main/java/com/example/orders/HomeController.java', `
package com.example.orders;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
@Controller
public class HomeController { @GetMapping("/") public String home() { return "home"; } }
`);
write('spring-boot/src/main/resources/application.properties', 'server.port=8080\n');

// Express (server-rendered)
write('express/package.json', `
{
  "name": "orders-express",
  "private": true,
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.21.2", "express-session": "^1.18.1" }
}
`);
write('express/server.js', `
const express = require('express');
const session = require('express-session');
const app = express();
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-only', resave: false, saveUninitialized: false }));
app.get('/', (req, res) => res.send('<h1>Orders</h1><a href="/login">Sign in</a>'));
app.get('/orders', (req, res) => res.json([{ id: 1, item: 'Widget' }]));
app.listen(3000, () => console.log('http://localhost:3000'));
`);

// ASP.NET Core Razor Pages
write('dotnet/Orders.csproj', `
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup><TargetFramework>net9.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>enable</ImplicitUsings></PropertyGroup>
</Project>
`);
write('dotnet/Program.cs', `
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorPages();
var app = builder.Build();
app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();
app.Run();
`);
write('dotnet/appsettings.json', `
{ "Logging": { "LogLevel": { "Default": "Information" } }, "AllowedHosts": "*" }
`);
write('dotnet/Properties/launchSettings.json', `
{ "profiles": { "Orders": { "commandName": "Project", "applicationUrl": "https://localhost:5001;http://localhost:5000" } } }
`);
write('dotnet/Pages/Index.cshtml', `
@page
<h1>Orders</h1><p>Sign in to see your orders.</p>
`);

// Flutter
write('flutter/pubspec.yaml', `
name: orders_mobile
description: Orders mobile app
publish_to: 'none'
version: 1.0.0+1
environment:
  sdk: ^3.7.0
dependencies:
  flutter:
    sdk: flutter
flutter:
  uses-material-design: true
`);
write('flutter/lib/main.dart', `
import 'package:flutter/material.dart';
void main() => runApp(const OrdersApp());
class OrdersApp extends StatelessWidget {
  const OrdersApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(home: Scaffold(appBar: AppBar(title: const Text('Orders')), body: const Center(child: Text('Sign in to see your orders.'))));
}
`);

// Track B: the API to protect
write('orders-api/package.json', `
{ "name": "orders-api", "private": true, "scripts": { "start": "node server.js" }, "dependencies": { "express": "^4.21.2" } }
`);
write('orders-api/server.js', `
const express = require('express');
const app = express();
app.use(express.json());
const orders = [{ id: 1, item: 'Widget', qty: 2 }];
app.get('/orders', (req, res) => res.json(orders));
app.post('/orders', (req, res) => { const o = { id: orders.length + 1, ...req.body }; orders.push(o); res.status(201).json(o); });
app.delete('/orders/:id', (req, res) => { const i = orders.findIndex(o => o.id === Number(req.params.id)); if (i < 0) return res.sendStatus(404); orders.splice(i, 1); res.sendStatus(204); });
app.listen(4000, () => console.log('orders api on http://localhost:4000'));
`);

// Track F: the MCP server to secure
write('orders-mcp/package.json', `
{ "name": "orders-mcp", "private": true, "type": "module", "scripts": { "start": "node server.js" }, "dependencies": { "express": "^4.21.2", "@modelcontextprotocol/sdk": "^1.12.0", "zod": "^3.24.0" } }
`);
write('orders-mcp/server.js', `
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
`);

// Track E: the agent that needs an identity
write('orders-assistant/package.json', `
{ "name": "orders-assistant", "private": true, "type": "module", "scripts": { "start": "node agent.js" }, "dependencies": { "@anthropic-ai/sdk": "^0.50.0", "dotenv": "^16.5.0" } }
`);
write('orders-assistant/agent.js', `
import 'dotenv/config';
// An assistant that answers questions about a user's orders by calling the Orders API
// (http://localhost:4000, scopes read:orders / write:orders). It has no identity yet:
// every request below goes out unauthenticated.
async function listOrders() {
  const res = await fetch('http://localhost:4000/orders');
  return res.json();
}
console.log(await listOrders());
`);
write('orders-assistant/.gitignore', 'node_modules/\n.env\n');
write('orders-assistant/.env.example', 'ORDERS_API=http://localhost:4000\n');

let appFiles = 0;
(function count(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? count(path.join(d, e.name)) : appFiles++; })(APPS);
console.log(`  apps: ${fs.readdirSync(APPS).length} projects, ${appFiles} files -> ${path.relative(REPO_ROOT, APPS)}`);

// ---- 3. stub CLI ----------------------------------------------------------
fs.rmSync(BIN, { recursive: true, force: true });
fs.mkdirSync(HELP, { recursive: true });
fs.copyFileSync(path.join(EVALS, 'stub', 'asg.js'), path.join(BIN, 'asg.js'));
// Node 22 consumes a `--env-file` meant for the stub unless `--` precedes the args.
fs.writeFileSync(path.join(BIN, 'asg'), '#!/bin/sh\n# Stub asg CLI for evals. See asg.js.\nexec node "$(dirname "$0")/asg.js" -- "$@"\n', { mode: 0o755 });
console.log(`  stub: ${path.relative(REPO_ROOT, path.join(BIN, 'asg'))}`);

// ---- 4. help texts from the real CLI ---------------------------------------
const realAsg = process.env.ASG_BIN || (spawnSync('sh', ['-c', 'command -v asg'], { encoding: 'utf8' }).stdout || '').trim();
if (!realAsg || realAsg.startsWith(BIN)) {
  fail('the real `asg` CLI is not on PATH. The stub serves its --help text, so install it first '
    + '(the skill\'s scripts/install-asg-cli.js does this) or set ASG_BIN=<path to asg>.');
}
const SKIP = new Set(['help', 'completion']);
let captured = 0;
function capture(words, depth) {
  const r = spawnSync(realAsg, [...words, '--help'], { encoding: 'utf8' });
  const text = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 || /unknown command/i.test(text)) return;
  fs.writeFileSync(path.join(HELP, (words.length ? words.join('_') : 'root') + '.txt'), text);
  captured++;
  if (depth >= 3) return;
  const block = text.split(/^Available Commands:\s*$/m)[1];
  if (!block) return;
  let started = false;
  for (const line of block.split('\n')) {
    if (!line.trim()) { if (started) break; continue; } // skip the header's own line end
    started = true;
    const cmd = line.trim().split(/\s+/)[0];
    if (cmd && !SKIP.has(cmd)) capture([...words, cmd], depth + 1);
  }
}
capture([], 0);
console.log(`  help: ${captured} commands captured from ${realAsg}`);
console.log('fixtures ready');
