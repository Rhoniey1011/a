#!/usr/bin/env python3
# MOVA Faucet + Send Script (proxy SOCKS5 + hapus proxy mati langsung + checksum address)

import json
import random
import requests
import threading
from requests.exceptions import ProxyError, ConnectionError, SSLError, Timeout
from web3 import Web3, HTTPProvider
from eth_account import Account
from colorama import Fore, Style, init

init(autoreset=True)

RPC_URL = "https://mars.rpc.movachain.com"
CHAIN_ID = 10323
EXPLORER = "https://mars.scan.movachain.com/tx/"

w3 = Web3(HTTPProvider(RPC_URL))

MARS_FAUCET = "https://faucet.mars.movachain.com/api/faucet/v1/transfer"

KEY_FILE = "key.json"
PROXY_FILE = "proxy.txt"

lock = threading.Lock()

def load_proxies():
    try:
        with open(PROXY_FILE, "r") as f:
            return [p.strip() for p in f if p.strip()]
    except:
        return []

def save_proxies(proxies):
    with lock:
        with open(PROXY_FILE, "w") as f:
            for p in proxies:
                f.write(p + "\n")

def save_keys(wallets):
    with open(KEY_FILE, "w") as f:
        json.dump(wallets, f, indent=2)

def create_wallet():
    acct = Account.create()
    return acct.address, acct.key.hex()

def prepare_socks5_proxy(proxy):
    proxy_url = f"socks5://{proxy}"
    return {"http": proxy_url, "https": proxy_url}

def remove_dead_proxy(proxy_to_remove, proxies):
    with lock:
        if proxy_to_remove in proxies:
            proxies.remove(proxy_to_remove)
            save_proxies(proxies)
            print(f"{Fore.RED}  ❌ Removed dead proxy: {proxy_to_remove}{Style.RESET_ALL}")

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
                proxies=proxies_dict, timeout=15
            )
        else:
            resp = requests.post(MARS_FAUCET, json=data, headers=headers, timeout=15)

        result = resp.json()
        if result.get("error") == "200":
            tx_hash = result.get("data")
            print(f"  🌌 Faucet Tx: {Fore.CYAN}{EXPLORER}{tx_hash}{Style.RESET_ALL}")
        else:
            print(f"  ❌ Faucet Error: {Fore.RED}{result.get('err_msg', 'Unknown error')}{Style.RESET_ALL}")
        return result
    except (ProxyError, ConnectionError, SSLError, Timeout) as e:
        print(f"  ⚠️ Faucet Proxy/Connection Error: {Fore.YELLOW}{e}{Style.RESET_ALL}")
        return None
    except Exception as e:
        print(f"  ⚠️ Faucet Exception: {Fore.YELLOW}{e}{Style.RESET_ALL}")
        return None

def send_tokens(sender_key, recipient, amount, proxies=None, proxy=None):
    try:
        acct = Account.from_key(sender_key)
        sender = acct.address

        nonce = w3.eth.get_transaction_count(sender)
        gas_price = w3.eth.gas_price

        recipient_checksum = w3.to_checksum_address(recipient)

        tx = {
            "chainId": CHAIN_ID,
            "from": sender,
            "to": recipient_checksum,
            "value": w3.to_wei(amount, "ether"),
            "gas": 2000000,
            "gasPrice": gas_price,
            "nonce": nonce,
            "data": b"",
        }

        signed_tx = w3.eth.account.sign_transaction(tx, sender_key)

        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

        print(f"{Fore.GREEN}  ✅ Sent {amount} MOVA → {recipient_checksum}{Style.RESET_ALL}")
        print(f"  🔗 Tx Hash: {Fore.CYAN}{EXPLORER}{w3.to_hex(tx_hash)}{Style.RESET_ALL}")
        return w3.to_hex(tx_hash)

    except (ProxyError, ConnectionError, SSLError, Timeout) as e:
        print(f"{Fore.RED}  ❌ Send failed proxy error: {e}{Style.RESET_ALL}")
        if proxy and proxies:
            remove_dead_proxy(proxy, proxies)
        return None
    except Exception as e:
        print(f"{Fore.RED}  ❌ Send failed: {e}{Style.RESET_ALL}")
        return None

def main():
    proxies = load_proxies()
    print(Fore.YELLOW + "Select Faucet to Claim:" + Style.RESET_ALL)
    print("1. Mars Faucet")
    print("2. Send Tokens")
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
                if proxy and proxy in proxies:
                    remove_dead_proxy(proxy, proxies)

        print(f"\n{Fore.GREEN}✅ Finished processing faucet claims.{Style.RESET_ALL}")

    elif choice == "2":
        try:
            with open(KEY_FILE, "r") as f:
                wallets = json.load(f)
        except:
            print(Fore.RED + "❌ No wallets found. Run faucet first." + Style.RESET_ALL)
            return

        recipient = input("➡️ Enter recipient address: ").strip()
        amount = float(input("💰 Amount to send (MOVA): "))
        for w in wallets:
            proxy = random.choice(proxies) if proxies else None
            send_tokens(w["private_key"], recipient, amount, proxies, proxy)

if __name__ == "__main__":
    main()
