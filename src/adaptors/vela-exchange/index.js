const ethers = require('ethers');
const sdk = require('@defillama/sdk');
const utils = require('../utils');
const VaultABI = require('./VaultABI.json');
const VLPABI = require('./VLPABI.json');
const TokenFarmABI = require('./TokenFarmABI.json');
const axios = require('axios');

const VELA_ADDRESS = {
  ['arbitrum']: '0x088cd8f5eF3652623c22D48b1605DCfE860Cd704',
  ['base']: '0x5A76A56ad937335168b30dF3AA1327277421C6Ae',
};
const BRIDGED_USDC_ADDRESS = {
  ['arbitrum']: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  ['base']: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
};
const VAULT_ADDRESS = '0xC4ABADE3a15064F9E3596943c699032748b13352';
const VLP_ADDRESS = {
  ['arbitrum']: '0xC5b2D9FDa8A82E8DcECD5e9e6e99b78a9188eB05',
  ['base']: '0xEBf154Ee70de5237aB07Bd6428310CbC5e5c7C6E',
};
const TOKEN_FARM_ADDRESS = {
  ['arbitrum']: '0x60b8C145235A31f1949a831803768bF37d7Ab7AA',
  ['base']: '0x00B01710c2098b883C4F93dD093bE8Cf605a7BDe',
};
const RPC = {
  ['arbitrum']: 'https://arbitrum.llamarpc.com',
  ['base']: 'https://mainnet.base.org',
};
const chains = ['arbitrum', 'base'];

const poolsFunction = async () => {
  const pools = [];
  const secondsPerYear = 31536000;

  for (let i = 0; i < chains.length; i++) {
    const chain = chains[i];
    // 14 days
    let distance = await axios(
      `https://coins.llama.fi/block/${chain}/${Math.floor(
        new Date(new Date(Date.now() - 12096e5)).getTime() / 1000
      )}`
    );

    sdk.api.config.setProvider(
      `${chain}`,
      new ethers.providers.JsonRpcProvider(`${RPC[chain]}`)
    );

    const velaPrice = (
      await utils.getPrices(
        ['0x088cd8f5eF3652623c22D48b1605DCfE860Cd704'],
        'arbitrum'
      )
    ).pricesBySymbol.vela;

    const current = (
      await sdk.api.abi.call({
        target: VAULT_ADDRESS,
        abi: VaultABI.filter(({ name }) => name === 'getVLPPrice')[0],
        chain: `${chain}`,
      })
    ).output;

    const totalSupply = (
      await sdk.api.abi.call({
        target: VLP_ADDRESS[chain],
        abi: VLPABI.filter(({ name }) => name === 'totalSupply')[0],
        chain: `${chain}`,
      })
    ).output;

    const historical = (
      await sdk.api.abi.call({
        target: VAULT_ADDRESS,
        abi: VaultABI.filter(({ name }) => name === 'getVLPPrice')[0],
        chain: `${chain}`,
        block: distance.data.height,
      })
    ).output;

    const rewardsPerSecond = ethers.utils.formatEther(
      (
        await sdk.api.abi.call({
          target: TOKEN_FARM_ADDRESS[chain],
          abi: TokenFarmABI.filter(
            ({ name }) => name === 'poolRewardsPerSec'
          )[0],
          chain: `${chain}`,
          params: [0],
        })
      ).output[3].toString()
    );

    const poolTotal = ethers.utils.formatEther(
      (
        await sdk.api.abi.call({
          target: TOKEN_FARM_ADDRESS[chain],
          abi: TokenFarmABI.filter(({ name }) => name === 'poolTotalLp')[0],
          chain: `${chain}`,
          params: [1],
        })
      ).output
    );

    const diff = current - historical;
    const APR = 365 * (diff / historical / 14) * 100;

    if (poolTotal > 0) {
      VELA_APR =
        ((rewardsPerSecond * secondsPerYear * velaPrice) /
          (poolTotal * parseFloat(ethers.utils.formatUnits(current, 5)))) *
        100;
    } else {
      VELA_APR = 0;
    }

    const VLPPool = {
      pool: `${VAULT_ADDRESS}-${chain}`.toLowerCase(),
      chain: utils.formatChain(`${chain}`),
      project: 'vela-exchange',
      symbol: 'USDC',
      poolMeta: 'VLP',
      tvlUsd: (Number(totalSupply) / 1e18) * (Number(current) / 1e5),
      apyBase: APR,
      underlyingTokens: [BRIDGED_USDC_ADDRESS[chain]],
      rewardTokens: [VELA_ADDRESS[chain]],
      apyReward: VELA_APR,
      poolMeta:
        'Reward tokens are issued after staking VLP and rewards are in $esVela. Users can deposit $esVELA into the vesting contract in order to claim the same amount of $VELA. This is unlocked continuously throughout a one year (365 days) linear vesting period.',
    };

    pools.push(VLPPool);
  }

  return pools;
};

module.exports = {
  timetravel: false,
  apy: poolsFunction,
  url: 'https://app.vela.exchange/staking/vlp',
};
