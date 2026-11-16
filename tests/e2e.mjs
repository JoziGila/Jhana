// End-to-end check of the built app in headless Chromium: onboarding → sit → debrief → next plan.
// Run with: node tests/e2e.mjs   (needs dist/ember.html; `make build` creates it)
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('SKIP e2e: playwright is not installed in this environment');
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(resolve(root, 'dist/ember.html')).href;
const shots = resolve(root, 'dist/screens');
mkdirSync(shots, { recursive: true });
const shoot = process.argv.includes('--screens');

const browser = await chromium.launch();
const errors = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shoot ? 2 : 1, colorScheme: opts.colorScheme ?? 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.addInitScript((speed) => { window.__emberSpeed = speed; }, opts.speed ?? 120);
  await page.goto(url);
  return page;
}

async function noOverflow(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `${label}: page scrolls sideways by ${over}px`);
}

async function onboard(page, answers = {}) {
  await page.getByRole('button', { name: 'How it works' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  const groups = page.locator('.item');
  const n = await groups.count();
  assert.equal(n, 9, 'nine onboarding questions');
  for (let i = 0; i < n; i++) {
    const pick = answers[i] ?? 2;
    await groups.nth(i).locator('.scale button').nth(pick).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Set up my first sit' }).click();
}

// ---- 1. full journey: a striver whose pleasant feeling collapses when it starts ----------------
{
  const page = await newPage();
  await noOverflow(page, 'welcome');
  if (shoot) await page.screenshot({ path: `${shots}/01-welcome.png` });
  // striver = question index 7 answered "Very much"
  await onboard(page, { 7: 3 });
  await page.waitForSelector('.card.plan');
  await noOverflow(page, 'home');
  const planText = await page.locator('.card.plan').innerText();
  assert.match(planText, /Very light/, 'a self-described striver starts with very light effort');
  if (shoot) await page.screenshot({ path: `${shots}/02-home.png`, fullPage: true });

  await page.getByRole('button', { name: /Begin \d+-minute sit/ }).click();
  await page.waitForSelector('.stage');
  await page.waitForFunction(() => document.querySelector('.stage .cue')?.textContent.length > 10);
  if (shoot) await page.screenshot({ path: `${shots}/03-sit.png` });
  // wait for the rest phase, then signal "here" with one tap
  await page.waitForFunction(() => document.querySelector('.stage .phase')?.textContent === 'Rest', null, { timeout: 30000 });
  await page.locator('.stage .pad').click();
  await page.waitForTimeout(700);
  // two taps = stuck: a pointer must appear
  await page.locator('.stage .pad').click();
  await page.locator('.stage .pad').click({ delay: 20 });
  await page.waitForFunction(() => document.querySelector('.stage .cue.on') !== null);
  if (shoot) await page.screenshot({ path: `${shots}/04-rest.png` });
  // let the sit run out
  await page.waitForSelector('.sheet', { timeout: 40000 });
  assert.equal(await page.locator('.stage').count(), 0, 'stage is removed after the sit');

  // debrief
  await page.locator('#note').fill('A warm glow started in my chest and grew, then I got excited and it vanished.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /It grew/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await noOverflow(page, 'debrief symptoms');
  if (shoot) await page.screenshot({ path: `${shots}/05-debrief.png`, fullPage: true });
  await page.getByRole('button', { name: /vanished when I noticed/ }).click();
  await page.getByRole('button', { name: /hold on to it/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'A few seconds' }).click();
  const items = page.locator('.sheet .item');
  const count = await items.count();
  assert.ok(count >= 13, 'closer-look items are shown');
  await items.nth(1).locator('.scale button').nth(2).click(); // pleasure: clearly
  await items.nth(5).locator('.scale button').nth(2).click(); // bright: clearly
  await page.getByRole('button', { name: 'See the reading' }).click();
  await page.waitForSelector('.verdict');
  const reading = await page.locator('.sheet').innerText();
  assert.match(reading, /Grabbing when it starts/, 'diagnosis: grasping at the onset');
  assert.match(reading, /do nothing|nothing/i, 'prescription mentions doing nothing');
  assert.doesNotMatch(reading, /First jhana \(probable\)/, 'a collapse after a few seconds is not read as jhana');
  await noOverflow(page, 'reading');
  if (shoot) await page.screenshot({ path: `${shots}/06-reading.png`, fullPage: true });
  await page.getByRole('button', { name: 'Done' }).click();

  // home now shows the changed plan
  const home2 = await page.locator('.card.plan').innerText();
  assert.match(home2, /grabbing when it starts/i);
  // state persisted across reload
  await page.reload();
  await page.waitForSelector('.card.plan');
  assert.match(await page.locator('header.brand').innerText(), /Sit 2/);

  // progress
  await page.getByRole('link', { name: 'Progress' }).click();
  await page.waitForSelector('.tiles');
  assert.match(await page.locator('.page').innerText(), /It grew/);
  await noOverflow(page, 'progress');
  if (shoot) await page.screenshot({ path: `${shots}/07-progress.png`, fullPage: true });

  // learn: the simulator responds to presets
  await page.getByRole('link', { name: 'Learn' }).click();
  await page.waitForSelector('.simverdict');
  assert.match(await page.locator('.simverdict').innerText(), /Catches at about minute/);
  await page.getByRole('radio', { name: 'Trying hard' }).click();
  assert.match(await page.locator('.simverdict').innerText(), /tension/);
  await page.getByRole('radio', { name: 'Grabbing at it' }).click();
  assert.match(await page.locator('.simverdict').innerText(), /collapses/);
  await noOverflow(page, 'learn');
  if (shoot) await page.screenshot({ path: `${shots}/08-learn.png`, fullPage: true });
  await page.context().close();
}

// ---- 2. ending early, a low-rung report, and the light theme -----------------------------------
{
  const page = await newPage({ colorScheme: 'light', speed: 30 });
  await onboard(page);
  await page.waitForSelector('.card.plan');
  if (shoot) await page.screenshot({ path: `${shots}/09-home-light.png`, fullPage: true });
  await page.getByRole('radio', { name: 'Tired' }).click();
  assert.match(await page.locator('.card.plan').innerText(), /tired/i, 'pre-sit state changes today\'s plan');
  await page.getByRole('button', { name: /Begin/ }).click();
  await page.waitForSelector('.stage');
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('button', { name: 'End' }).click();
  await page.waitForSelector('.sheet');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /Settled/ }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Sleepy, foggy/ }).click();
  await page.getByRole('button', { name: 'See the reading' }).click();
  const reading = await page.locator('.sheet').innerText();
  assert.match(reading, /Sinking into drowsiness/);
  assert.match(reading, /Wake the body up first/);
  if (shoot) await page.screenshot({ path: `${shots}/10-reading-light.png`, fullPage: true });
  await page.context().close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('e2e: ok (2 journeys, no console errors, no sideways scroll at 390px)');
