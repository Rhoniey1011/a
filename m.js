import blessed from "blessed";
import figlet from "figlet";
import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";

const RPC_URL = "https://mars.rpc.movachain.com/";
const REQUEST_URL = "https://faucet.marsapi.movachain.com/api/faucet/v1/transfer";
const NETWORK_NAME = "Mova Testnet";

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

const proxies = fs.existsSync("proxy.txt")
  ? fs.readFileSync("proxy.txt", "utf8")
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean)
  : [];

let activeProxy = proxies.length > 0 ? proxies[0] : null;

function parseProxyIP(proxy) {
  if (!proxy) return "No proxy";
  const match = proxy.match(/@([^:]+)/);
  return match ? match[1] : proxy;
}

async function getPublicIP(proxy) {
  try {
    const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
    const res = await axios.get("https://api.ipify.org?format=json", {
      httpsAgent: agent,
      timeout: 10000,
      headers: { "User-Agent": getRandomUserAgent() },
    });
    return res.data.ip;
  } catch (e) {
    return "Unavailable";
  }
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

let processRunning = false;
let processCancelled = false;
let transactionLogs = [];
let headerContentHeight = 0;
function activeProxyInfo() {
  return activeProxy ? activeProxy : "No proxy";
}

function readAccounts() {
  if (!fs.existsSync("account.json")) return [];
  try {
    return JSON.parse(fs.readFileSync("account.json", "utf8"));
  } catch (err) {
    addLog("Error membaca account.json: " + err.message, "error");
    return [];
  }
}

function saveAccount(newAccount) {
  const accounts = readAccounts();
  accounts.push(newAccount);
  try {
    fs.writeFileSync("account.json", JSON.stringify(accounts, null, 2));
    addLog(`Wallet ${shortAddress(newAccount.address)} berhasil disimpan.`, "system");
  } catch (err) {
    addLog("Error menyimpan account.json: " + err.message, "error");
  }
}

function addLog(message, type = "system") {
  const timestamp = new Date().toLocaleTimeString();
  let colored;
  if (type === "system") colored = `{bright-white-fg}${message}{/bright-white-fg}`;
  else if (type === "error") colored = `{bright-red-fg}${message}{/bright-red-fg}`;
  else if (type === "progress") colored = `{bright-yellow-fg}${message}{/bright-yellow-fg}`;
  else if (type === "success") colored = `{bright-green-fg}${message}{/bright-green-fg}`;
  else colored = `{magenta-fg}${message}{/magenta-fg}`;
  transactionLogs.push(`[ {bold}{grey-fg}${timestamp}{/grey-fg}{/bold} ] ${colored}`);

  const MAX_LOGS = 70;
  if (transactionLogs.length > MAX_LOGS) {
    transactionLogs.splice(0, transactionLogs.length - MAX_LOGS);
  }

  updateLogs();
}

function updateLogs() {
  const newContent = transactionLogs.join("\n") || "";
  logsBox.setContent(newContent);
  if (newContent.length > 0) logsBox.setScrollPerc(100);
  else logsBox.setScroll(0);
  screen.render();
}

function clearTransactionLogs() {
  transactionLogs = [];
  logsBox.setContent("");
  logsBox.setScroll(0);
  addLog("Transaction logs telah dihapus.", "system");
  screen.render();
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

const screen = blessed.screen({
  smartCSR: true,
  title: "Mova Faucet Bot",
  tags: true,
});

const headerBox = blessed.box({
  top: 0,
  left: "center",
  width: "100%",
  height: 1,
  tags: true,
  align: "center",
});

figlet.text("NT EXHAUST".toUpperCase(), { font: "ANSI Shadow", horizontalLayout: "default" }, (err, data) => {
  let asciiBanner = "";
  if (!err) {
    asciiBanner = `{center}{bold}{green-fg}${data}{/green-fg}{/bold}{/center}`;
  } else {
    asciiBanner = "{center}{bold}MOVA BOT{/bold}{/center}";
  }
  headerBox.setContent(`${asciiBanner}\n`);
  headerContentHeight = headerBox.getContent().split("\n").length + 1;
  adjustLayout();
  screen.render();
});
screen.append(headerBox);

const logsBox = blessed.box({
  label: " Transaction Logs",
  top: 9,
  left: "41%",
  width: "59%",
  height: "100%-9",
  border: { type: "line" },
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  tags: true,
  scrollbar: { ch: "│", style: { bg: "cyan", fg: "white" }, track: { bg: "gray" } },
  scrollback: 70,
  smoothScroll: true,
  style: { border: { fg: "magenta" }, bg: "default", fg: "white" },
  padding: { left: 1, right: 1, top: 0, bottom: 0 },
  wrap: true,
  focusable: true,
  keys: true
});

const walletBox = blessed.box({
  label: " Wallet Information ",
  border: { type: "line", fg: "magenta" },
  tags: true,
});

function getMenuItems() {
  let arr = [];
  if (processRunning) {
    arr.push("{grey-fg}Generate Wallet & Claim Faucet{/grey-fg}");
    arr.push("{grey-fg}Claim Faucet{/grey-fg}");
    arr.push("{grey-fg}Auto Send Token{/grey-fg}");
  } else {
    arr.push("Generate Wallet & Claim Faucet");
    arr.push("Claim Faucet");
    arr.push("Auto Send Token");
  }
  arr.push("Change Proxy");
  arr.push("Refresh");
  arr.push("Clear Transaction Logs");
  if (processRunning) arr.push("Cancel Process");
  arr.push("Exit");
  return arr;
}

function updateMenuItems() {
  menuList.setItems(getMenuItems());
  screen.render();
}

const menuList = blessed.list({
  label: " Menu ",
  border: { type: "line", fg: "yellow" },
  keys: true,
  vi: true,
  mouse: true,
  parseTags: true,
  style: { selected: { bg: "blue", fg: "white" } },
  items: getMenuItems(),
});

screen.append(logsBox);
screen.append(walletBox);
screen.append(menuList);

function adjustLayout() {
  const { width, height } = screen;
  headerBox.top = 0;
  headerBox.left = "center";
  headerBox.width = "100%";
  headerBox.height = headerContentHeight;
  logsBox.top = headerContentHeight;
  logsBox.left = 0;
  logsBox.width = Math.floor(width * 0.6);
  logsBox.height = height - headerContentHeight;
  const rightX = Math.floor(width * 0.6);
  const rightWidth = Math.floor(width * 0.4);
  const totalRightHeight = height - headerContentHeight;
  const walletBoxHeight = Math.floor(totalRightHeight * 0.35);
  walletBox.top = headerContentHeight;
  walletBox.left = rightX;
  walletBox.width = rightWidth;
  walletBox.height = walletBoxHeight;
  menuList.top = headerContentHeight + walletBoxHeight;
  menuList.left = rightX;
  menuList.width = rightWidth;
  menuList.height = totalRightHeight - walletBoxHeight;

  screen.render();
}

screen.on("resize", () => {
  adjustLayout();
});

adjustLayout();
screen.render();
menuList.focus();

function createPrompt() {
  return blessed.prompt({
    parent: screen,
    border: "line",
    height: "20%",
    width: "50%",
    top: "center",
    left: "center",
    label: "{bright-blue-fg}Input Prompt{/bright-blue-fg}",
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    inputOnFocus: true,
    style: { fg: "white", bg: "default", border: { fg: "red" } },
  });
}

async function promptNonEmpty(question) {
  const p = createPrompt();
  screen.append(p);
  p.show();
  p.setFront();
  return new Promise((resolve, reject) => {
    p.readInput(question, "", (err, value) => {
      p.hide();
      p.detach();
      screen.render();
      if (err) reject(err);
      else if (!value || !value.trim()) reject(new Error("Input tidak boleh kosong"));
      else resolve(value.trim());
    });
  }).catch(e => {
    addLog(`Prompt error: ${e.message}`, "error");
    return null;
  });
}

async function updateWalletData() {
  const accounts = readAccounts();
  const balances = await Promise.all(
    accounts.map(acc =>
      provider.getBalance(acc.address).catch(e => {
        addLog(`Gagal ambil saldo ${shortAddress(acc.address)}: ${e.message}`, "error");
        return 0n;
      })
    )
  );
  const totalBalance = balances.reduce((sum, b) => sum + b, 0n);
  const totalStr = ethers.formatEther(totalBalance);
  walletBox.setContent(
    `Total Wallet: ${accounts.length}\n` +
    `Total Saldo: ${totalStr} MARS\n` +
    `Active Proxy: ${activeProxyInfo()}`
  );
  addLog("Saldo & Wallet Updated");
  screen.render();
}

async function pickWalletFromList(accounts) {
  const balances = await Promise.all(
    accounts.map(acc => provider.getBalance(acc.address).catch(() => 0n))
  );
  const items = accounts.map((acc, idx) =>
    `${idx + 1}. ${shortAddress(acc.address)} (Saldo: ${ethers.formatEther(balances[idx])} MARS)`
  );
  return new Promise((resolve, reject) => {
    const container = blessed.box({
      label: " Pilih Wallet ",
      top: "10%",
      left: "center",
      width: "80%",
      height: "60%",
      border: { type: "line", fg: "cyan" },
      keys: true,
      mouse: true,
      interactive: true,
    });
    const walletList = blessed.list({
      parent: container,
      top: 0,
      left: 0,
      width: "100%",
      height: "80%",
      label: "{bold}Daftar Wallet{/bold}",
      border: { type: "line", fg: "yellow" },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      parseTags: true,
      style: { selected: { bg: "blue", fg: "white" } },
      scrollbar: {
        ch: " ",
        inverse: true,
        style: { bg: "blue" },
        track: { bg: "grey" },
        interactive: true
      },
    });
    walletList.setItems(items);
    const cancelButton = blessed.button({
      parent: container,
      bottom: 0,
      left: "center",
      shrink: true,
      padding: { left: 2, right: 2 },
      content: "Cancel",
      mouse: true,
      keys: true,
      interactive: true,
      style: { fg: "white", bg: "red", hover: { bg: "blue" } },
    });
    cancelButton.on("press", () => {
      container.detach();
      screen.render();
      reject();
    });
    walletList.on("select", (el, selectedIdx) => {
      container.detach();
      screen.render();
      resolve(selectedIdx);
    });
    container.key(["escape", "q", "C-c"], () => {
      container.detach();
      screen.render();
      reject();
    });
    screen.append(container);
    walletList.focus();
    screen.render();
  });
}

async function countdown(seconds) {
  return new Promise((resolve) => {
    let remaining = seconds;
    const countdownBox = blessed.box({
      parent: screen,
      bottom: 1,
      right: 56,
      width: "shrink",
      height: "shrink",
      tags: true,
      border: { type: "line", fg: "cyan" },
      style: { fg: "white", bg: "default" },
      content: `Menunggu: ${remaining} detik`
    });
    screen.append(countdownBox);
    screen.render();
    const interval = setInterval(() => {
      if (processCancelled) {
        clearInterval(interval);
        countdownBox.detach();
        screen.render();
        addLog("Waktu tunggu dibatalkan.", "system");
        resolve();
        return;
      }
      remaining--;
      if (remaining <= 0) {
        clearInterval(interval);
        countdownBox.detach();
        screen.render();
        resolve();
      } else {
        countdownBox.setContent(`Menunggu: ${remaining} detik`);
        screen.render();
      }
    }, 1000);
  });
}

async function randomCountdown(min, max) {
  const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
  await countdown(seconds);
}

async function submitRequest(proxy, walletAddress) {
  const publicIP = await getPublicIP(proxy);
  addLog(`Menggunakan IP: ${publicIP}`, "system");
  const agent = proxy ? new HttpsProxyAgent(proxy) : null;
  const reqData = { to: walletAddress };
  try {
    const resp = await axios.post(REQUEST_URL, reqData, {
      headers: {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "content-type": "application/json",
        "origin": "https://faucet.mars.movachain.com",
        "priority": "u=1, i",
        "referer": "https://faucet.mars.movachain.com/",
        "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": getRandomUserAgent()
      },
      httpsAgent: agent,
    });
    if (resp.data.err_msg || (resp.data.error && resp.data.error !== "200")) {
      addLog(`Error Faucet: ${resp.data.err_msg || resp.data.error}`, "error");
    } else {
      addLog(`Tx Hash: ${resp.data.data}`, "success");
    }
  } catch (e) {
    let msg = e.response?.data?.err_msg || e.response?.data?.error || e.message;
    addLog(`Error Faucet: ${msg}`, "error");
  }
}

async function handleChangeProxy() {
  const items = proxies.map(proxy =>
    proxy === activeProxy ? `${proxy} [ACTIVE]` : proxy
  );
  return new Promise((resolve, reject) => {
    const container = blessed.box({
      label: " Change Proxy ",
      top: "center",
      left: "center",
      width: "80%",
      height: "60%",
      border: { type: "line", fg: "cyan" },
      keys: true,
      mouse: true,
      interactive: true,
    });
    const proxyList = blessed.list({
      parent: container,
      top: 0,
      left: 0,
      width: "100%",
      height: "80%",
      label: "{bold}Daftar Proxy{/bold}",
      border: { type: "line", fg: "yellow" },
      keys: true,
      vi: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      parseTags: true,
      style: { selected: { bg: "blue", fg: "white" } },
      scrollbar: {
        ch: " ",
        inverse: true,
        style: { bg: "blue" },
        track: { bg: "grey" },
        interactive: true
      },
    });
    proxyList.setItems(items);
    const cancelButton = blessed.button({
      parent: container,
      bottom: 0,
      left: "center",
      shrink: true,
      padding: { left: 2, right: 2 },
      content: "Cancel",
      mouse: true,
      keys: true,
      interactive: true,
      style: { fg: "white", bg: "red", hover: { bg: "blue" } },
    });
    cancelButton.on("press", () => {
      container.detach();
      screen.render();
      reject("Cancelled");
      menuList.focus();
    });
    proxyList.on("select", (el, selectedIdx) => {
      container.detach();
      screen.render();
      activeProxy = proxies[selectedIdx];
      addLog(`Active proxy diubah menjadi: ${activeProxy}`, "success");
      updateWalletData();
      resolve();
      menuList.focus();
    });
    container.key(["escape", "q", "C-c"], () => {
      container.detach();
      screen.render();
      reject("Cancelled");
      menuList.focus();
    });
    screen.append(container);
    proxyList.focus();
    screen.render();
  });
}

async function handleGenerateWalletAndClaimFaucet() {
  const promptInst = await createPrompt();
  screen.append(promptInst);
  promptInst.show();
  promptInst.setFront();
  promptInst.readInput("Masukkan jumlah wallet yang akan dibuat:", "", async (err, val) => {
    promptInst.hide();
    promptInst.detach();
    screen.render();
    if (!val || err) {
      menuList.focus();
      return;
    }
    const count = parseInt(val);
    if (isNaN(count) || count <= 0) {
      addLog("Jumlah wallet tidak valid.", "error");
      menuList.focus();
      return;
    }
    processRunning = true;
    updateMenuItems();
    addLog(`Mulai generate ${count} wallet...`, "system");
    const accounts = readAccounts();
    for (let i = 0; i < count; i++) {
      if (processCancelled) {
        addLog("Proses Telah Dibatalkan.", "system");
        break;
      }
      const proxy = activeProxy ? activeProxy : (proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null);
      const w = ethers.Wallet.createRandom();
      addLog(`Wallet ${i + 1} Dibuat : ${shortAddress(w.address)}`, "success");
      const newAcc = { address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic.phrase };
      accounts.push(newAcc);
      fs.writeFileSync("account.json", JSON.stringify(accounts, null, 2));
      addLog(`Mengklaim faucet untuk ${shortAddress(w.address)}`, "progress");
      await submitRequest(proxy, w.address);
      await updateWalletData();
      addLog(`Wallet ${i + 1} Claim Faucet Berhasil`, "success");
      if (i < count - 1) {
        await randomCountdown(10, 15);
      }
    }
    processRunning = false;
    processCancelled = false;
    updateMenuItems();
    addLog("Generate & Claim faucet selesai.", "system");
    menuList.focus();
  });
}


async function handleClaimFaucet() {
  const accounts = readAccounts();
  if (accounts.length === 0) {
    addLog("Tidak ada account di account.json", "error");
    return;
  }
  addLog(`Ada ${accounts.length} wallet.`, "system");
  const promptInst = await createPrompt();
  screen.append(promptInst);
  promptInst.show();
  promptInst.setFront();
  promptInst.readInput("Claim faucet untuk semua wallet? (y/n):", "", async (err, val) => {
    promptInst.hide();
    promptInst.detach();
    screen.render();
    if (!val || err) {
      menuList.focus();
      return;
    }
    if (val.toLowerCase() === "y") {
      processRunning = true;
      updateMenuItems();
      for (let i = 0; i < accounts.length; i++) {
        if (processCancelled) {
          addLog("Proses Telah Dibatalkan.", "system");
          break;
        }
        const a = accounts[i];
        const proxy = activeProxy ? activeProxy : (proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null);
        addLog(`Mengklaim faucet untuk ${shortAddress(a.address)}`, "progress");
        if (proxy) {
          const publicIP = await getPublicIP(proxy);
          addLog(`Menggunakan IP: ${publicIP}`, "system");
        } else {
          addLog(`Menggunakan koneksi langsung (No proxy)`, "system");
        }
        await submitRequest(proxy, a.address);
        await updateWalletData();
        addLog(`Wallet ${i + 1} Claim Faucet Berhasil`, "success");
        if (i < accounts.length - 1) {
          await randomCountdown(10, 15);
        }
      }
      processRunning = false;
      processCancelled = false;
      updateMenuItems();
      addLog("Claim faucet selesai.", "system");
      menuList.focus();
    } else {
      try {
        const idx = await pickWalletFromList(accounts);
        addLog(`Memilih wallet ke-${idx + 1}: ${shortAddress(accounts[idx].address)}`, "system");
        processRunning = true;
        updateMenuItems();
        const proxy = activeProxy ? activeProxy : (proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null);
        addLog(`Mengklaim faucet untuk ${shortAddress(accounts[idx].address)}`, "progress");
        if (proxy) {
          const publicIP = await getPublicIP(proxy);
          addLog(`Menggunakan IP: ${publicIP}`, "system");
        } else {
          addLog(`Menggunakan koneksi langsung (No proxy)`, "system");
        }
        await submitRequest(proxy, accounts[idx].address);
        await updateWalletData();
        addLog(`Wallet ${idx + 1} Claim Faucet Berhasil`, "success");
        processRunning = false;
        processCancelled = false;
        updateMenuItems();
        menuList.focus();
      } catch (e) {
        addLog("Batal Memilih Wallet.", "system");
        menuList.focus();
      }
    }
  });
}

async function handleAutoSendToken() {
  processRunning = true;
  updateMenuItems();
  const promptInst = await createPrompt();
  screen.append(promptInst);
  promptInst.show();
  promptInst.setFront();
  promptInst.readInput("Kirim token dari semua wallet? (y/n):", "", async (err, val) => {
    promptInst.hide();
    promptInst.detach();
    screen.render();
    if (!val || err) {
      processRunning = false;
      updateMenuItems();
      menuList.focus();
      return;
    }
    if (val.toLowerCase() === "y") {
      let recipient = await promptNonEmpty("Masukkan alamat penerima:");
      if (!recipient) {
        processRunning = false;
        updateMenuItems();
        menuList.focus();
        return;
      }
      let amount = await promptNonEmpty("Masukkan jumlah token (MARS) yang akan dikirim (Per Wallet):");
      if (!amount) {
        processRunning = false;
        updateMenuItems();
        menuList.focus();
        return;
      }
      const accounts = readAccounts();
      const balances = await Promise.all(
        accounts.map(acc => provider.getBalance(acc.address).catch(() => 0n))
      );
      const sufficient = accounts.filter((acc, idx) => balances[idx] >= ethers.parseEther(amount));
      addLog(`Ada ${sufficient.length} wallet dengan saldo cukup.`, "system");
      addLog("Konfirmasi pengiriman token...", "system");
      const confirmPrompt = await createPrompt();
      screen.append(confirmPrompt);
      confirmPrompt.show();
      confirmPrompt.setFront();
      confirmPrompt.readInput("Konfirmasi kirim jumlah token yang ditentukan dari semua wallet yang saldo cukup? (y/n):", "", async (err, confirmVal) => {
        confirmPrompt.hide();
        confirmPrompt.detach();
        screen.render();
        if (!confirmVal || err || confirmVal.toLowerCase() !== "y") {
          addLog("Pengiriman dibatalkan.", "system");
          processRunning = false;
          updateMenuItems();
          menuList.focus();
          return;
        }
        await Promise.all(sufficient.map(async (a, i) => {
          if (processCancelled) {
            addLog(`Pengiriman untuk wallet ${shortAddress(a.address)} dibatalkan.`, "system");
            return;
          }
          const wallet = new ethers.Wallet(a.privateKey, provider);
          addLog(`Melakukan pengiriman ${amount} MARS dari wallet ${shortAddress(a.address)}`, "system");
          try {
            const tx = await wallet.sendTransaction({
              to: recipient,
              value: ethers.parseEther(amount),
            });
            addLog(`Tx dikirim: ${tx.hash}`, "success");
            const receipt = await tx.wait();
            if (receipt && receipt.status === 1) {
              addLog(`Pengiriman Terkonfirmasi, Tx Hash: ${tx.hash}`, "success");
              addLog(`Transaksi ${i + 1}/${sufficient.length} selesai.`, "system");
            } else {
              addLog(`Pengiriman Gagal, Tx Hash: ${tx.hash}`, "error");
            }
          } catch (e) {
            addLog(`Error pengiriman dari ${shortAddress(a.address)}: ${e.message}`, "error");
          }
        }));
        await updateWalletData();
        addLog("Saldo & Wallet di-update. Pengiriman selesai.", "system");
        processRunning = false;
        updateMenuItems();
        menuList.focus();
      });
    } else {
      const accounts = readAccounts();
      try {
        const idx = await pickWalletFromList(accounts);
        addLog(`Memilih wallet ke-${idx + 1}: ${shortAddress(accounts[idx].address)}`, "system");
        let recipient = await promptNonEmpty("Masukkan alamat penerima:");
        if (!recipient) {
          processRunning = false;
          updateMenuItems();
          menuList.focus();
          return;
        }
        let amount = await promptNonEmpty("Masukkan jumlah token (MARS) yang akan dikirim (Per Wallet):");
        if (!amount) {
          processRunning = false;
          updateMenuItems();
          menuList.focus();
          return;
        }
        const chosen = accounts[idx];
        const bal = await provider.getBalance(chosen.address);
        if (bal < ethers.parseEther(amount)) {
          addLog(`Saldo ${shortAddress(chosen.address)} tidak cukup.`, "error");
          processRunning = false;
          updateMenuItems();
          menuList.focus();
          return;
        }
        const wallet = new ethers.Wallet(chosen.privateKey, provider);
        addLog(`Melakukan pengiriman ${amount} MARS dari wallet ${shortAddress(chosen.address)} ke ${shortAddress(recipient)}`, "progress");
        try {
          const tx = await wallet.sendTransaction({
            to: recipient,
            value: ethers.parseEther(amount),
          });
          addLog(`Tx dikirim: ${tx.hash}`, "success");
          const receipt = await tx.wait();
          if (receipt && receipt.status === 1) {
            addLog(`Pengiriman Terkonfirmasi, Tx Hash: ${tx.hash}`, "success");
            addLog(`Transaksi untuk wallet ${shortAddress(chosen.address)} selesai.`, "success");
          } else {
            addLog(`Pengiriman Gagal, Tx Hash: ${tx.hash}`, "error");
          }
        } catch (e) {
          addLog(`Error: ${e.message}`, "error");
        }
        await updateWalletData();
        processRunning = false;
        updateMenuItems();
        menuList.focus();
      } catch (e) {
        processRunning = false;
        updateMenuItems();
        menuList.focus();
      }
    }
  });
}

menuList.on("select", async (item) => {
  const txt = item.getText().replace(/{[^}]+}/g, "");
  if (processRunning &&
      (txt === "Generate Wallet & Claim Faucet" ||
       txt === "Claim Faucet" ||
       txt === "Auto Send Token")) {
    addLog("Ada proses berjalan, tunggu atau pilih 'Cancel Process' terlebih dahulu.", "system");
    return;
  }
  if (txt === "Generate Wallet & Claim Faucet") {
    await handleGenerateWalletAndClaimFaucet();
  } else if (txt === "Claim Faucet") {
    await handleClaimFaucet();
  } else if (txt === "Auto Send Token") {
    await handleAutoSendToken();
  } else if (txt === "Change Proxy") {
    try {
      await handleChangeProxy();
    } catch (e) {
      addLog("Proxy change cancelled.", "system");
    }
    menuList.focus();
  } else if (txt === "Refresh") {
    addLog("Refresh wallet info...", "system");
    await updateWalletData();
  } else if (txt === "Clear Transaction Logs") {
    clearTransactionLogs();
  } else if (txt === "Cancel Process") {
    if (processRunning) {
      processCancelled = true;
      addLog("Stop process diperintahkan.", "system");
    } else {
      addLog("Tidak ada proses berjalan.", "system");
    }
  } else if (txt === "Exit") {
    process.exit(0);
  }
});

screen.key(["escape", "q", "C-c"], () => process.exit(0));

menuList.focus();
screen.render();
addLog("Dont Forget To Subscribe YT And Telegram @NTExhaust!!", "system");
updateWalletData();
