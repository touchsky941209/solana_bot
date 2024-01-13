import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import {
  Liquidity,
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityPoolKeys,
  Market,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  publicKey,
  struct,
  MAINNET_PROGRAM_ID,
} from '@raydium-io/raydium-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { USDC_TOKEN_ID } from '../common';

export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = MAINNET_PROGRAM_ID.AmmV4;
export const OPENBOOK_PROGRAM_ID = MAINNET_PROGRAM_ID.OPENBOOK_MARKET;

export const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
  publicKey('eventQueue'),
  publicKey('bids'),
  publicKey('asks'),
]);

export type MinimalLiquidityAccountData = {
  id: PublicKey;
  version: 4;
  programId: PublicKey;
};

export async function getAllAccountsV4(
  connection: Connection,
): Promise<MinimalLiquidityAccountData[]> {
  const { span } = LIQUIDITY_STATE_LAYOUT_V4;
  const accounts = await connection.getProgramAccounts(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    {
      dataSlice: { offset: 0, length: 0 },
      commitment: 'processed',
      filters: [
        { dataSize: span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
            bytes: USDC_TOKEN_ID.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
            bytes: OPENBOOK_PROGRAM_ID.toBase58(),
          },
        },
      ],
    },
  );

  return accounts.map(
    (info) =>
      <MinimalLiquidityAccountData>{
        id: info.pubkey,
        version: 4,
        programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
      },
  );
}

export async function getAccountPoolKeysFromAccountDataV4(
  connection: Connection,
  id: PublicKey,
  accountData: any,
  commitment?: Commitment,
): Promise<LiquidityPoolKeys> {
  const marketInfo = await connection.getAccountInfo(accountData.marketId, {
    commitment: commitment ?? 'processed',
    dataSlice: {
      offset: 253, // eventQueue
      length: 32 * 3,
    },
  });

  const minimalMarketData = MINIMAL_MARKET_STATE_LAYOUT_V3.decode(
    marketInfo!.data,
  );

  return {
    id,
    baseMint: accountData.baseMint,
    quoteMint: accountData.quoteMint,
    lpMint: accountData.lpMint,
    baseDecimals: accountData.baseDecimal.toNumber(),
    quoteDecimals: accountData.quoteDecimal.toNumber(),
    lpDecimals: 5,
    version: 4,
    programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    authority: Liquidity.getAssociatedAuthority({
      programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    }).publicKey,
    openOrders: accountData.openOrders,
    targetOrders: accountData.targetOrders,
    baseVault: accountData.baseVault,
    quoteVault: accountData.quoteVault,
    marketVersion: 3,
    marketProgramId: accountData.marketProgramId,
    marketId: accountData.marketId,
    marketAuthority: Market.getAssociatedAuthority({
      programId: accountData.marketProgramId,
      marketId: accountData.marketId,
    }).publicKey,
    marketBaseVault: accountData.baseVault,
    marketQuoteVault: accountData.quoteVault,
    marketBids: minimalMarketData.bids,
    marketAsks: minimalMarketData.asks,
    marketEventQueue: minimalMarketData.eventQueue,
    withdrawQueue: accountData.withdrawQueue,
    lpVault: accountData.lpVault,
    lookupTableAccount: PublicKey.default,
  };
}

export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      programId: account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}
