#!/usr/bin/env python3
# MOVA Faucet Script - Looping terus menerus create wallet + claim faucet dengan proxy SOCKS5

import json
import random
import requests
from web3 import Web3, HTTPProvider
from eth_account import Account
from colorama import Fore, Style, init
import time

# Init colorama untuk warna console
init(autoreset=True)

# Detail jaringan MOVA
RPC_URL = "https://mars.rpc.movachain.com"
CHAIN_ID = 10323
EXPLORER = "https://mars.scan.movachain.com/tx/"

w3 = Web3(HTTPProvider(RPC_URL))

# Endpoint faucet MOVA
MARS_FAUCET = "https://faucet.mars.movachain.com/api/faucet/v1/transfer"

# Nama berkas simpan private key
KEY_FILE = "key.json"

# Fungsi load proxy dari file proxy.txt
def load_proxies():
    try:
        with open("proxy.txt", "r") as f:
            return [p.strip() for p in f if p.strip()]
    except Exception:
        return []

proxies = load_proxies()

# Fungsi simpan wallet ke file key.json
def save_keys(wallets):
    with open(KEY_FILE, "w") as f:
        json.dump(wallets, f, indent=2)

# Fungsi buat wallet baru
def create_wallet():
    acct = Account.create()
    return acct.address, acct.key.hex()

# Siapkan konfigurasi proxy SOCKS5 untuk requests
def prepare_socks5_proxy(proxy):
    proxy_url = f"socks5://{proxy}"
    return {
        "http": proxy_url,
        "https": proxy_url
    }

# Fungsi klaim faucet dengan proxy opsional
def claim_faucet(address, proxy=None):
    headers = {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Origin": "https://faucet.mars.movachain.com",
        "Referer": "https://faucet.mars.movachain.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/139.0.0.0 Safari/537.36"
    }
    data = {"to": address}
    try:
        if proxy:
            proxies_dict = prepare_socks5_proxy(proxy)
            resp = requests.post(
                MARS_FAUCET, json=data, headers=headers,
                proxies=proxies_dict, timeout=20
            )
        else:
            resp = requests.post(MARS_FAUCET, json=data, headers=headers, timeout=20)

        result = resp.json()
        if result.get("error") == "200":
            tx_hash = result.get("data")
            print(f"  🌌 Faucet Tx: {Fore.CYAN}{EXPLORER}{tx_hash}{Style.RESET_ALL}")
        else:
            print(f"  ❌ Faucet Error: {Fore.RED}{result.get('err_msg', 'Unknown error')}{Style.RESET_ALL}")
        return result
    except Exception as e:
        print(f"  ⚠️ Faucet Exception: {Fore.YELLOW}{e}{Style.RESET_ALL}")
        return None

def main():
    print(f"{Fore.YELLOW}Starting infinite wallet creation and faucet claim loop...{Style.RESET_ALL}")
    wallets = []
    i = 1
    while True:
        print(f"\n[{i}] Creating Wallet and Claiming Faucet...")
        address, private_key = create_wallet()
        proxy = random.choice(proxies) if proxies else None
        print(f"  📌 Address: {Fore.CYAN}{address}{Style.RESET_ALL}")
        print(f"  🔑 Private Key: {Fore.MAGENTA}{private_key}{Style.RESET_ALL}")
        if proxy:
            print(f"  🌐 Proxy Used: {Fore.YELLOW}{proxy}{Style.RESET_ALL}")
        result = claim_faucet(address, proxy)
        if result and result.get("error") == "200":
            wallets.append({"address": address, "private_key": private_key})
            save_keys(wallets)
            print(f"{Fore.GREEN}✅ Wallet saved after successful faucet claim.{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}❌ Wallet not saved due to faucet claim failure.{Style.RESET_ALL}")
        i += 1
        time.sleep(2)  # Delay 2 detik agar tidak spamming faucet

if __name__ == "__main__":
    print(f"{Fore.BLUE}Note: Install dependency untuk proxy SOCKS5 dengan:")
    print("  pip install requests[socks] web3 eth_account colorama\n" + Style.RESET_ALL)
    main()
