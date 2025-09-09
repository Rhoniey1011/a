#!/usr/bin/env node
// NEAR Mobile Bot - Enhanced CLI Interface
// Usage examples:
//   node bot.js --ref=E9418U
//   node bot.js --prefix=yl --ref=E9418U
//   node bot.js --handle=yuli12.near --ref=E9418U

import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import inquirer from 'inquirer';
import cliProgress from 'cli-progress';

const androidUserAgents = [
  "Mozilla/5.0 (Linux; Android 13; SM-G996B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; Redmi Note 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; SM-A107F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.5615.136 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 9; Mi 9T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.5563.57 Mobile Safari/537.36"
];

function getRandomAndroidUserAgent() {
  const ua = androidUserAgents[Math.floor(Math.random() * androidUserAgents.length)];
  const chromeVersionMinor = Math.floor(Math.random() * 50) + 4900;
  const chromeVersionPatch = Math.floor(Math.random() * 200) + 100;
  return ua.replace(/Chrome\/\d+\.\d+\.\d+\.\d+/, `Chrome/115.${chromeVersionMinor}.${chromeVersionPatch}.0`);
}

const CONFIG = {
  rpcBases: [
    'https://near.lava.build',
    'https://free.rpc.fastnear.com',
    'https://rpc.mainnet.near.org'
  ],
  relayerBase: 'https://near-mobile-production.aws.peersyst.tech',
  defaultReferral: 'E9418U',
  timeoutMs: 30000,
  retry: 3,
  maxUsernameAttempts: 10,
  // Make userAgent a getter, produce random UA each call
  get userAgent() {
    return getRandomAndroidUserAgent();
  },
};

const __dirname = path.resolve();
const jar = new CookieJar();
const https = (await import('https')).default || (await import('https'));

// Enhanced HTTP client with better error handling
function makeClient(baseURL) {
  return wrapper(axios.create({
    baseURL,
    timeout: CONFIG.timeoutMs,
    jar,
    withCredentials: true,
    headers: {
      'user-agent': CONFIG.userAgent,
      'accept': 'application/json',
      'content-type': 'application/json',
    },
    validateStatus: () => true,
  }));
}

const rpcClients = CONFIG.rpcBases.map(makeClient);
const relayerClient = makeClient(CONFIG.relayerBase);

// Enhanced utilities with better error handling
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function retry(fn, tries = CONFIG.retry, delay = 1000) {
  let lastError;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < tries - 1) {
        const waitTime = delay * Math.pow(2, i); // Exponential backoff
        await sleep(waitTime);
      }
    }
  }
  throw lastError;
}

async function requestWithFallback(buildPayload, operation = 'API request') {
  let lastErr;
  
  for (let i = 0; i < rpcClients.length; i++) {
    const cli = rpcClients[i];
    const { method, url, headers, data } = buildPayload();
    
    try {
      const res = await retry(() => cli.request({ method, url, headers, data }), 2, 500);
      if (res.status >= 200 && res.status < 500) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (e) {
      lastErr = e;
    }
  }
  
  throw lastErr;
}

// Natural username generation
const adjectives = [
  'cool', 'smart', 'fast', 'bright', 'happy', 'lucky', 'brave', 'wise', 'kind', 'bold',
  'quick', 'sharp', 'calm', 'wild', 'free', 'pure', 'true', 'real', 'deep', 'high',
  'low', 'big', 'small', 'new', 'old', 'young', 'fresh', 'clean', 'clear', 'soft',
  'hard', 'warm', 'cold', 'hot', 'sweet', 'sour', 'bitter', 'spicy', 'smooth', 'rough',
  'quiet', 'loud', 'bright', 'dark', 'light', 'heavy', 'strong', 'weak', 'rich', 'poor',
  'epic', 'awesome', 'amazing', 'incredible', 'fantastic', 'wonderful', 'perfect', 'super', 'mega', 'ultra',
  'crypto', 'nft', 'web3', 'defi', 'blockchain', 'digital', 'virtual', 'cyber', 'tech', 'future',
  'alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma', 'zeta', 'theta', 'lambda', 'phi'
];

const nouns = [
  'cat', 'dog', 'bird', 'fish', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer',
  'rabbit', 'mouse', 'rat', 'snake', 'frog', 'turtle', 'crab', 'shark', 'whale', 'dolphin',
  'eagle', 'hawk', 'owl', 'crow', 'duck', 'goose', 'swan', 'penguin', 'parrot', 'peacock',
  'star', 'moon', 'sun', 'cloud', 'rain', 'snow', 'wind', 'storm', 'thunder', 'lightning',
  'river', 'lake', 'ocean', 'mountain', 'forest', 'desert', 'island', 'beach', 'cave', 'cliff',
  'tree', 'flower', 'grass', 'rock', 'stone', 'gem', 'crystal', 'diamond', 'gold', 'silver',
  'fire', 'water', 'earth', 'air', 'ice', 'steam', 'smoke', 'dust', 'sand', 'mud',
  'king', 'queen', 'prince', 'princess', 'knight', 'wizard', 'witch', 'dragon', 'unicorn', 'phoenix',
  'hero', 'warrior', 'hunter', 'archer', 'sword', 'shield', 'armor', 'helmet', 'crown', 'throne',
  'book', 'pen', 'paper', 'ink', 'paint', 'brush', 'canvas', 'art', 'music', 'song',
  'dream', 'hope', 'love', 'joy', 'peace', 'freedom', 'truth', 'justice', 'honor', 'glory',
  'ape', 'dude', 'guy', 'bro', 'sis', 'kid', 'boy', 'girl', 'man', 'woman',
  'hacker', 'coder', 'dev', 'pro', 'guru', 'master', 'boss', 'chief', 'leader', 'captain',
  'ninja', 'samurai', 'viking', 'pirate', 'spy', 'agent', 'detective', 'sheriff', 'ranger', 'scout',
  'gamer', 'player', 'streamer', 'youtuber', 'influencer', 'creator', 'artist', 'designer', 'builder', 'maker',
  'trader', 'investor', 'hodler', 'miner', 'validator', 'node', 'wallet', 'token', 'coin', 'nft',
  'planet', 'galaxy', 'universe', 'cosmos', 'nebula', 'comet', 'asteroid', 'meteor', 'blackhole', 'wormhole',
  'robot', 'android', 'cyborg', 'ai', 'bot', 'drone', 'satellite', 'spaceship', 'rocket', 'ufo',
  'ghost', 'vampire', 'zombie', 'alien', 'monster', 'beast', 'creature', 'spirit', 'soul', 'mind'
];

const suffixes = [
  'er', 'or', 'ist', 'ian', 'ly', 'ful', 'less', 'able', 'ible', 'ous', 
  'ious', 'eous', 'al', 'ial', 'ic', 'ical', 'ive', 'ative', 'itive', 'ent', 
  'ant', 'ing', 'ed', 'en', 'ish', 'like', 'y', 'ey', 'ie'
];

const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const specialChars = ['x', 'z', 'q', 'v', 'w'];

function randDigits(n = 3) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function genUsername(prefix = 'yl') {
  const patterns = [
    () => `${prefix}${getRandomElement(adjectives)}${getRandomElement(nouns)}`,
    () => `${prefix}${getRandomElement(nouns)}${getRandomElement(adjectives)}`,
    () => `${prefix}${getRandomElement(adjectives)}${getRandomElement(nouns)}${getRandomElement(suffixes)}`,
    () => `${prefix}${getRandomElement(nouns)}${randDigits(2)}`,
    () => `${prefix}${getRandomElement(adjectives)}${randDigits(2)}`,
    () => `${prefix}${getRandomElement(nouns)}${getRandomElement(nouns)}`,
    () => `${prefix}${getRandomElement(adjectives)}${getRandomElement(adjectives)}`,
    () => `${prefix}${getRandomElement(nouns)}${getRandomElement(specialChars)}${getRandomElement(numbers)}`,
    () => `${prefix}${getRandomElement(adjectives)}${getRandomElement(specialChars)}${getRandomElement(numbers)}`,
    () => `${prefix}${getRandomElement(nouns)}${getRandomElement(suffixes)}${getRandomElement(numbers)}`,
    () => `${prefix}${getRandomElement(adjectives)}${getRandomElement(suffixes)}${getRandomElement(numbers)}`,
    () => `${prefix}${randDigits(2)}${getRandomElement(nouns)}`,
    () => `${prefix}${randDigits(2)}${getRandomElement(adjectives)}`,
    () => `${prefix}${getRandomElement(specialChars)}${getRandomElement(nouns)}${getRandomElement(numbers)}`,
    () => `${prefix}${getRandomElement(specialChars)}${getRandomElement(adjectives)}${getRandomElement(numbers)}`,
    () => `${prefix}${Date.now().toString().slice(-4)}`
  ];
  
  const pattern = getRandomElement(patterns);
  return `${pattern()}.near`;
}

function makeEd25519() {
  const kp = nacl.sign.keyPair();
  const pub = 'ed25519:' + bs58.encode(Buffer.from(kp.publicKey));
  const secret = bs58.encode(Buffer.from(kp.secretKey));
  return { publicKey: pub, secretKey: secret };
}

function saveSession(obj) {
  try {
    const sessionPath = path.join(__dirname, 'session.json');
    fs.writeFileSync(sessionPath, JSON.stringify(obj, null, 2));
    console.log(chalk.cyan(`💾 Session saved to: ${sessionPath}`));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to save session: ${error.message}`));
  }
}

function loadSession() {
  try {
    const sessionPath = path.join(__dirname, 'session.json');
    if (!fs.existsSync(sessionPath)) return null;
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`❌ Failed to load session: ${error.message}`));
    return null;
  }
}

// Enhanced RPC builders
function buildViewAccount(handle) {
  return () => ({
    method: 'POST',
    url: '/',
    headers: {},
    data: {
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1e6),
      method: 'query',
      params: {
        request_type: 'view_account',
        account_id: handle,
        finality: 'optimistic'
      }
    }
  });
}

function isAvailable(respData) {
  const msg = respData?.error?.message || respData?.error?.data || '';
  if (respData?.error && /does not exist/i.test(msg)) return true;
  if (respData?.result) return false;
  if (/UNKNOWN_ACCOUNT/i.test(JSON.stringify(respData))) return true;
  return false;
}

// Enhanced Relayer builders
async function createRelayerAccount({ handle, publicKey }) {
  try {
    const res = await retry(() => relayerClient.post(
      '/api/relayer/account',
      { publicKey, id: handle },
      { headers: { 'user-agent': CONFIG.userAgent } }
    ));
    
    if (res.status !== 201) {
      throw new Error(`Relayer create failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
    }
    
    const token = String(res.data || '').trim();
    return token;
  } catch (error) {
    throw error;
  }
}

async function redeemReferral({ code, address }) {
  try {
    const res = await retry(() => relayerClient.post(
      '/api/referral/redeem',
      { redeemedCode: code, address },
      { headers: { 'accept': 'application/json', 'user-agent': CONFIG.userAgent } }
    ));
    
    if (res.status !== 201) {
      throw new Error(`Redeem failed: HTTP ${res.status} ${JSON.stringify(res.data)}`);
    }
    
    return true;
  } catch (error) {
    throw error;
  }
}

// Enhanced verification
async function verifyAccountExists(handle) {
  try {
    const res = await requestWithFallback(buildViewAccount(handle));
    const exists = !!res.data?.result;
    return exists;
  } catch (error) {
    throw error;
  }
}

// CLI argument parsing with validation
function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const m = a.match(/^--([^=]+)=(.*)$/);
      return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
    })
  );
  
  return {
    handle: typeof args.handle === 'string' ? args.handle : null,
    prefix: typeof args.prefix === 'string' ? args.prefix : 'yl',
    refCode: typeof args.ref === 'string' ? args.ref : CONFIG.defaultReferral,
    interactive: args.interactive || args.i || false,
    verbose: args.verbose || args.v || false,
    bulk: typeof args.bulk === 'string' ? parseInt(args.bulk) : (args.bulk ? 5 : 1),
    delay: typeof args.delay === 'string' ? parseInt(args.delay) : 2000,
    output: typeof args.output === 'string' ? args.output : 'bulk_accounts.json'
  };
}

// Beautiful CLI interface
function showBanner() {
  console.clear();
  const banner = figlet.textSync('NEAR BOT', {
    font: 'Big Money-sw',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  console.log(gradient.rainbow(banner));
  console.log(boxen(
    chalk.cyan('🚀 NEAR Mobile Account Creator & Referral Redeemer'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
  console.log(chalk.gray('Created by: 0xboomtu | X: @0xboomtu | GitHub: weck25\n'));
}

// Interactive mode
async function interactiveMode() {
  const questions = [
    {
      type: 'input',
      name: 'prefix',
      message: 'Enter username prefix (default: yl):',
      default: 'yl',
      validate: (input) => {
        if (input.length < 2) return 'Prefix must be at least 2 characters';
        if (!/^[a-z0-9]+$/i.test(input)) return 'Prefix can only contain letters and numbers';
        return true;
      }
    },
    {
      type: 'input',
      name: 'refCode',
      message: 'Enter referral code (default: E9418U):',
      default: CONFIG.defaultReferral,
      validate: (input) => {
        if (input.length < 3) return 'Referral code must be at least 3 characters';
        return true;
      }
    },
    {
      type: 'number',
      name: 'bulkCount',
      message: 'How many accounts to create (default: 5):',
      default: 5,
      validate: (input) => {
        if (input < 1 || input > 100) return 'Please enter a number between 1 and 100';
        return true;
      }
    },
    {
      type: 'number',
      name: 'delay',
      message: 'Delay between accounts in milliseconds (default: 2000):',
      default: 2000,
      validate: (input) => {
        if (input < 500) return 'Delay must be at least 500ms';
        return true;
      }
    },
    {
      type: 'input',
      name: 'outputFile',
      message: 'Output file name (default: bulk_accounts.json):',
      default: 'bulk_accounts.json'
    },
    {
      type: 'confirm',
      name: 'useCustomHandle',
      message: 'Do you want to use a custom handle? (only for single account)',
      default: false,
      when: (answers) => answers.bulkCount === 1
    },
    {
      type: 'input',
      name: 'customHandle',
      message: 'Enter custom handle:',
      when: (answers) => answers.useCustomHandle && answers.bulkCount === 1,
      validate: (input) => {
        if (!input.endsWith('.near')) return 'Handle must end with .near';
        if (input.length < 6) return 'Handle must be at least 6 characters';
        return true;
      }
    }
  ];

  const answers = await inquirer.prompt(questions);
  
  return {
    handle: answers.useCustomHandle ? answers.customHandle : null,
    prefix: answers.prefix,
    refCode: answers.refCode,
    bulk: answers.bulkCount,
    delay: answers.delay,
    output: answers.outputFile
  };
}

// Main execution function
async function runCreateRedeem(handle, refCode) {
  // Generate keypair
  const kp = makeEd25519();
  
  // Create relayer account
  const relayerToken = await createRelayerAccount({ handle, publicKey: kp.publicKey });
  
  // Save session
  const session = { 
    handle, 
    publicKey: kp.publicKey, 
    secretKey: kp.secretKey, 
    relayerToken,
    createdAt: new Date().toISOString(),
    referralCode: refCode
  };
  
  // Redeem referral
  if (refCode) {
    await redeemReferral({ code: refCode, address: handle });
  }
  
  // Verify on blockchain
  const verified = await verifyAccountExists(handle);
  
  return {
    ...session,
    verified,
    status: verified ? 'VERIFIED' : 'PENDING'
  };
}

// Bulk account creation function
async function runBulkCreation(config) {
  const { prefix, refCode, bulk: count, delay, output } = config;
  
  console.log(chalk.blue(`\n📋 Starting bulk NEAR account creation (${count} accounts)...\n`));
  
  const accounts = [];
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} accounts | ETA: {eta}s | Current: {currentHandle}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(count, 0, { currentHandle: 'Starting...' });
  
  for (let i = 0; i < count; i++) {
    try {
      // Generate handle
      const handle = genUsername(prefix);
      progressBar.update(i, { currentHandle: handle });
      
      // Check availability
      const checkRes = await requestWithFallback(buildViewAccount(handle));
      let available = isAvailable(checkRes.data);
      
      // If not available, try to find available one
      if (!available) {
        let tries = 0;
        let newHandle = handle;
        while (!isAvailable((await requestWithFallback(buildViewAccount(newHandle))).data)) {
          if (++tries >= CONFIG.maxUsernameAttempts) {
            throw new Error(`Failed to find available handle after ${CONFIG.maxUsernameAttempts} attempts`);
          }
          newHandle = genUsername(prefix);
        }
        available = true;
        progressBar.update(i, { currentHandle: newHandle });
      }
      
      // Create account
      const account = await runCreateRedeem(handle, refCode);
      accounts.push(account);
      
      progressBar.update(i + 1, { currentHandle: handle });
      
      // Delay between accounts (except for the last one)
      if (i < count - 1) {
        await sleep(delay);
      }
      
    } catch (error) {
      accounts.push({
        error: error.message,
        index: i + 1,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  progressBar.stop();
  
  // Save bulk results
  const bulkResults = {
    totalRequested: count,
    totalCreated: accounts.filter(a => !a.error).length,
    totalFailed: accounts.filter(a => a.error).length,
    createdAt: new Date().toISOString(),
    config: { prefix, refCode, delay },
    accounts
  };
  
  try {
    // Check if file exists and load existing data
    let existingData = null;
    if (fs.existsSync(output)) {
      try {
        const existingContent = fs.readFileSync(output, 'utf8');
        existingData = JSON.parse(existingContent);
        console.log(chalk.cyan(`📁 Found existing file: ${output}`));
      } catch (parseError) {
        console.log(chalk.yellow(`⚠️  Existing file corrupted, creating new file`));
      }
    }
    
    // Merge data if file exists
    if (existingData && Array.isArray(existingData)) {
      existingData.push(...accounts);
      const mergedResults = {
        totalRequested: existingData.length,
        totalCreated: existingData.filter(a => !a.error).length,
        totalFailed: existingData.filter(a => a.error).length,
        lastUpdated: new Date().toISOString(),
        config: { prefix, refCode, delay },
        accounts: existingData
      };
      fs.writeFileSync(output, JSON.stringify(mergedResults, null, 2));
      console.log(chalk.green(`\n💾 Added ${accounts.length} accounts to existing file: ${output}`));
    } else if (existingData && existingData.accounts && Array.isArray(existingData.accounts)) {
      const mergedAccounts = [...existingData.accounts, ...accounts];
      const mergedResults = {
        totalRequested: mergedAccounts.length,
        totalCreated: mergedAccounts.filter(a => !a.error).length,
        totalFailed: mergedAccounts.filter(a => a.error).length,
        lastUpdated: new Date().toISOString(),
        config: { prefix, refCode, delay },
        accounts: mergedAccounts
      };
      fs.writeFileSync(output, JSON.stringify(mergedResults, null, 2));
      console.log(chalk.green(`\n💾 Added ${accounts.length} accounts to existing file: ${output}`));
    } else {
      fs.writeFileSync(output, JSON.stringify(bulkResults, null, 2));
      console.log(chalk.green(`\n💾 Bulk results saved to: ${output}`));
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to save results: ${error.message}`));
  }
  
  // Show summary
  const successful = accounts.filter(a => !a.error);
  const failed = accounts.filter(a => a.error);
  
  console.log(chalk.green('\n🎉 Bulk creation completed!'));
  console.log(boxen(
    chalk.white(`Total Requested: ${chalk.cyan(count)}\n`) +
    chalk.white(`Successfully Created: ${chalk.green(successful.length)}\n`) +
    chalk.white(`Failed: ${chalk.red(failed.length)}\n`) +
    chalk.white(`Output File: ${chalk.cyan(output)}`),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: failed.length === 0 ? 'green' : 'yellow'
    }
  ));
  
  if (successful.length > 0) {
    console.log(chalk.cyan('\n📋 Successfully created accounts:'));
    successful.forEach((account, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${account.handle} - ${account.status}`));
    });
  }
  
  if (failed.length > 0) {
    console.log(chalk.red('\n❌ Failed accounts:'));
    failed.forEach((account, index) => {
      console.log(chalk.gray(`  ${account.index}. Error: ${account.error}`));
    });
  }
}

// Main execution
(async () => {
  try {
    showBanner();
    
    const args = parseArgs();
    let config;
    
    if (args.interactive) {
      config = await interactiveMode();
    } else {
      config = args;
    }
    
    const { handle: wantedHandle, prefix, refCode, bulk, delay, output } = config;
    
    console.log(chalk.blue('Configuration:'));
    console.log(chalk.gray(`  Prefix: ${prefix}`));
    console.log(chalk.gray(`  Referral: ${refCode}`));
    console.log(chalk.gray(`  Bulk Count: ${bulk}`));
    console.log(chalk.gray(`  Delay: ${delay}ms`));
    console.log(chalk.gray(`  Output: ${output}`));
    console.log(chalk.gray(`  Custom Handle: ${wantedHandle || 'Auto-generate'}`));
    
    if (bulk > 1) {
      if (wantedHandle) {
        console.log(chalk.yellow('\n⚠️  Custom handle specified but bulk mode is enabled. Ignoring custom handle.'));
      }
      await runBulkCreation(config);
    } else {
      const handle = wantedHandle || genUsername(prefix);
      console.log(chalk.cyan(`\n🎯 Target Handle: ${handle}`));
      
      console.log(chalk.cyan('\n🔍 Checking handle availability...'));
      const checkRes = await requestWithFallback(buildViewAccount(handle));
      const available = isAvailable(checkRes.data);
      
      if (available) {
        console.log(chalk.green(`✅ Handle ${handle} is available`));
        const account = await runCreateRedeem(handle, refCode);
        
        const singleResult = {
          totalRequested: 1,
          totalCreated: 1,
          totalFailed: 0,
          createdAt: new Date().toISOString(),
          config: { prefix, refCode },
          accounts: [account]
        };
        
        try {
          let existingData = null;
          if (fs.existsSync(output)) {
            try {
              const existingContent = fs.readFileSync(output, 'utf8');
              existingData = JSON.parse(existingContent);
              console.log(chalk.cyan(`📁 Found existing file: ${output}`));
            } catch (parseError) {
              console.log(chalk.yellow(`⚠️  Existing file corrupted, creating new file`));
            }
          }
          
          if (existingData && existingData.accounts && Array.isArray(existingData.accounts)) {
            const mergedAccounts = [...existingData.accounts, account];
            const mergedResults = {
              totalRequested: mergedAccounts.length,
              totalCreated: mergedAccounts.filter(a => !a.error).length,
              totalFailed: mergedAccounts.filter(a => a.error).length,
              lastUpdated: new Date().toISOString(),
              config: { prefix, refCode },
              accounts: mergedAccounts
            };
            fs.writeFileSync(output, JSON.stringify(mergedResults, null, 2));
            console.log(chalk.green(`\n💾 Added account to existing file: ${output}`));
          } else {
            fs.writeFileSync(output, JSON.stringify(singleResult, null, 2));
            console.log(chalk.green(`\n💾 Result saved to: ${output}`));
          }
        } catch (error) {
          console.error(chalk.red(`\n❌ Failed to save result: ${error.message}`));
        }
        
        console.log(chalk.green('\n🎉 Account created successfully!'));
        console.log(boxen(
          chalk.white(`Account: ${chalk.cyan(account.handle)}\n`) +
          chalk.white(`Status: ${account.verified ? chalk.green('✅ VERIFIED') : chalk.yellow('⚠️  PENDING')}\n`) +
          chalk.white(`Referral: ${chalk.cyan(refCode)}\n`) +
          chalk.white(`Output: ${chalk.cyan(output)}`),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: account.verified ? 'green' : 'yellow'
          }
        ));
      } else {
        console.log(chalk.yellow(`⚠️  Handle ${handle} is taken`));
        
        if (!wantedHandle) {
          console.log(chalk.cyan('\n🔄 Auto-generating new handle...'));
          let tries = 0;
          let newHandle = handle;
          
          while (!isAvailable((await requestWithFallback(buildViewAccount(newHandle))).data)) {
            if (++tries >= CONFIG.maxUsernameAttempts) {
              throw new Error(`Failed to find available handle after ${CONFIG.maxUsernameAttempts} attempts`);
            }
            newHandle = genUsername(prefix);
            console.log(chalk.gray(`   Trying: ${newHandle}`));
          }
          
          console.log(chalk.green(`✅ Found available handle: ${newHandle}`));
          const account = await runCreateRedeem(newHandle, refCode);
          
          const singleResult = {
            totalRequested: 1,
            totalCreated: 1,
            totalFailed: 0,
            createdAt: new Date().toISOString(),
            config: { prefix, refCode },
            accounts: [account]
          };
          
          try {
            let existingData = null;
            if (fs.existsSync(output)) {
              try {
                const existingContent = fs.readFileSync(output, 'utf8');
                existingData = JSON.parse(existingContent);
                console.log(chalk.cyan(`📁 Found existing file: ${output}`));
              } catch (parseError) {
                console.log(chalk.yellow(`⚠️  Existing file corrupted, creating new file`));
              }
            }
            
            if (existingData && existingData.accounts && Array.isArray(existingData.accounts)) {
              const mergedAccounts = [...existingData.accounts, account];
              const mergedResults = {
                totalRequested: mergedAccounts.length,
                totalCreated: mergedAccounts.filter(a => !a.error).length,
                totalFailed: mergedAccounts.filter(a => a.error).length,
                lastUpdated: new Date().toISOString(),
                config: { prefix, refCode },
                accounts: mergedAccounts
              };
              fs.writeFileSync(output, JSON.stringify(mergedResults, null, 2));
              console.log(chalk.green(`\n💾 Added account to existing file: ${output}`));
            } else {
              fs.writeFileSync(output, JSON.stringify(singleResult, null, 2));
              console.log(chalk.green(`\n💾 Result saved to: ${output}`));
            }
          } catch (error) {
            console.error(chalk.red(`\n❌ Failed to save result: ${error.message}`));
          }
          
          console.log(chalk.green('\n🎉 Account created successfully!'));
          console.log(boxen(
            chalk.white(`Account: ${chalk.cyan(account.handle)}\n`) +
            chalk.white(`Status: ${account.verified ? chalk.green('✅ VERIFIED') : chalk.yellow('⚠️  PENDING')}\n`) +
            chalk.white(`Referral: ${chalk.cyan(refCode)}\n`) +
            chalk.white(`Output: ${chalk.cyan(output)}`),
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: account.verified ? 'green' : 'yellow'
            }
          ));
        } else {
          throw new Error('Specified handle is already taken. Try a different handle or use auto-generation.');
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), chalk.white(error.message));
    
    if (error.response) {
      console.error(chalk.red('Response:'), chalk.gray(JSON.stringify(error.response.data, null, 2)));
    }
    
    process.exit(1);
  }
})();
