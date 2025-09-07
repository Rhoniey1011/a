#!/usr/bin/env python3
# MOVA Faucet + Send Script (with Proxy SOCKS5 + User-Agent + Explorer links + Colors)

import json
import random
import requests
from web3 import Web3, HTTPProvider
from eth_account import Account
from colorama import Fore, Style, init

# Init colorama
init(autoreset=True)

# === MOVA Network Details ===
RPC_URL = "https://mars.rpc.movachain.com"
CHAIN_ID = 10323
EXPLORER = "https://mars.scan.movachain.com/tx/"

w3 = Web3(HTTPProvider(RPC_URL))

# Faucet API
MARS_FAUCET = "https://faucet.mars.movachain.com/api/faucet/v1/transfer"

# File to save keys
KEY_FILE = "key.json"

# Load proxies from file (optional, format ip:port)
def load_proxies():
    try:
        with open("proxy.txt", "r") as f:
            return [p.strip() for p in f if p.strip()]
    except Exception:
        return []

proxies = load_proxies()

# Save keys
def save_keys(wallets):
    with open(KEY_FILE, "w") as f:
        json.dump(wallets, f, indent=2)

# Create Wallet
def create_wallet():
    acct = Account.create()
    return acct.address, acct.key.hex()

# Prepare proxies dict for requests (adds socks5:// prefix)
def prepare_socks5_proxy(proxy):
    proxy_url = f"socks5://{proxy}"
    return {
        "http": proxy_url,
        "https": proxy_url
    }

# Claim Faucet
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

# Send Tokens (no proxy)
def send_tokens(sender_key, recipient, amount):
    try:
        acct = Account.from_key(sender_key)
        sender = acct.address

        nonce = w3.eth.get_transaction_count(sender)
        gas_price = w3.eth.gas_price

        tx = {
            "chainId": CHAIN_ID,
            "from": sender,
            "to": recipient,
            "value": w3.to_wei(amount, "ether"),
            "gas": 2000000,
            "gasPrice": gas_price,
            "nonce": nonce,
            "data": b"",
        }

        signed_tx = w3.eth.account.sign_transaction(tx, sender_key)

        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

        print(f"{Fore.GREEN}  ✅ Sent {amount} MOVA → {recipient}{Style.RESET_ALL}")
        print(f"  🔗 Tx Hash: {Fore.CYAN}{EXPLORER}{w3.to_hex(tx_hash)}{Style.RESET_ALL}")
        return w3.to_hex(tx_hash)

    except Exception as e:
        print(f"{Fore.RED}  ❌ Send failed: {e}{Style.RESET_ALL}")
        return None

# === Main Menu ===
def main():
    print(Fore.YELLOW + "Select Faucet to Claim or Send Tokens:" + Style.RESET_ALL)
    print("1. Mars Faucet (with Proxy)")
    print("2. Send Tokens (without Proxy)")
    choice = input("👉 Enter choice: ")

    if choice == "1":
        wallets = []
        num = int(input("👉 How many accounts to create? "))
        for i in range(1, num + 1):
            address, private_key = create_wallet()
            proxy = random.choice(proxies) if proxies else None
            print(f"\n[{i}] Created Wallet:")
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

        print(f"\n{Fore.GREEN}✅ Finished processing faucet claims.{Style.RESET_ALL}")

    elif choice == "2":
        try:
            with open(KEY_FILE, "r") as f:
                wallets = json.load(f)
        except Exception:
            print(Fore.RED + "❌ No wallets found. Run faucet first." + Style.RESET_ALL)
            return

        recipient = input("➡️ Enter recipient address: ").strip()
        amount = float(input("💰 Amount to send (MOVA): "))
        for w in wallets:
            send_tokens(w["private_key"], recipient, amount)

if __name__ == "__main__":
    print(f"{Fore.BLUE}Note: Please install 'requests[socks]' package to enable SOCKS5 proxies.\nUse command: pip install requests[socks]{Style.RESET_ALL}\n")
    main()
