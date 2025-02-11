import { Connection, VersionedTransaction } from "@solana/web3.js";
import axios from 'axios';

interface Blockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

export const getTokenPrice = async (tokenAddr: string) => {
  const tokenAPrice = await axios.get(`https://api.geckoterminal.com/api/v2/simple/networks/solana/token_price/${tokenAddr}`);
  return parseFloat(tokenAPrice.data.data.attributes.token_prices[tokenAddr])
}

export const getTokenMarketCap = async (tokenAddr: string) => {
  const tokenInfo = await axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${tokenAddr}`);
  return parseFloat(tokenInfo.data.data.attributes.total_supply) * parseFloat(tokenInfo.data.data.attributes.price_usd) / (10 ** Number(tokenInfo.data.data.attributes.decimals));
}

export const execute = async (connection: Connection, transaction: VersionedTransaction) => {
  const signature = await connection.sendTransaction(transaction);
  // const signature = await connection.sendRawTransaction(transaction.serialize());
  return signature
}

