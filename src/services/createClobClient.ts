/**
 * ClobClient creation and configuration module.
 * This module provides functions to create and configure a ClobClient for interacting with Polymarket's API, handling Gnosis Safe detection and API key management.
 */

import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { ENV, FollowerWallet } from '../config/env';
import Logger from '../utils/logger';

const CLOB_HTTP_URL = ENV.CLOB_HTTP_URL;
const RPC_URL = ENV.RPC_URL;

/**
 * Determines if a wallet is a Gnosis Safe by checking if it has contract code.
 * @function isGnosisSafe
 * @param {string} address - The wallet address to check.
 * @returns {Promise<boolean>} True if the address is a Gnosis Safe.
 */
const isGnosisSafe = async (address: string): Promise<boolean> => {
    try {
        // Using ethers v5 syntax
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const code = await provider.getCode(address);
        // If code is not "0x", then it's a contract (likely Gnosis Safe)
        return code !== '0x';
    } catch (error) {
        Logger.error(`Error checking wallet type: ${error}`);
        return false;
    }
};

/**
 * Creates a ClobClient for a specific follower wallet (for multi-wallet copy trading).
 */
export const createClobClientForWallet = async (follower: FollowerWallet): Promise<ClobClient> => {
    const chainId = 137;
    const host = CLOB_HTTP_URL as string;
    const key = follower.privateKey.startsWith('0x') ? follower.privateKey : `0x${follower.privateKey}`;
    const wallet = new ethers.Wallet(key);
    const isProxySafe = await isGnosisSafe(follower.address);
    const signatureType = isProxySafe ? SignatureType.POLY_GNOSIS_SAFE : SignatureType.EOA;

    let clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        undefined,
        signatureType,
        isProxySafe ? follower.address : undefined
    );

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = function () {};
    console.error = function () {};

    let creds = await clobClient.createApiKey();
    if (!creds.key) {
        creds = await clobClient.deriveApiKey();
    }

    clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        creds,
        signatureType,
        isProxySafe ? follower.address : undefined
    );

    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    return clobClient;
};

/**
 * Returns one ClobClient per follower wallet. Used by executor for multi-wallet mode.
 */
export const getClobClients = async (): Promise<ClobClient[]> => {
    const followers = ENV.FOLLOWER_WALLETS;
    const clients: ClobClient[] = [];
    for (let i = 0; i < followers.length; i++) {
        const f = followers[i];
        Logger.info(
            `Initializing CLOB client ${i + 1}/${followers.length} for ${f.address.slice(0, 8)}...${f.address.slice(-4)}`
        );
        const client = await createClobClientForWallet(f);
        clients.push(client);
    }
    return clients;
};

/**
 * Creates and configures a ClobClient for the default (first) wallet.
 * @returns {Promise<ClobClient>} A promise that resolves to a configured ClobClient instance.
 */
const createClobClient = async (): Promise<ClobClient> => {
    const first = ENV.FOLLOWER_WALLETS[0];
    Logger.info(
        `Wallet type for ${first.address.slice(0, 8)}...${first.address.slice(-4)}`
    );
    return createClobClientForWallet(first);
};

export default createClobClient;
