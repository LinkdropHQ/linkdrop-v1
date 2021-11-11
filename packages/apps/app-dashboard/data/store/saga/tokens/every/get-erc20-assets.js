import { put, call, select } from 'redux-saga/effects'
import { getXDAIERC20Items, getERC20Items } from 'data/api/tokens'
import { defineNetworkName } from '@linkdrop/commons'
import getCurrentEthBalance from './get-current-eth-balance'

const generator = function * ({ payload }) {
  try {
    const currentAddress = yield select(generator.selectors.currentAddress)
    const chainId = yield select(generator.selectors.chainId)
    const networkName = defineNetworkName({ chainId })
    const { ethBalanceFormatted } = yield getCurrentEthBalance({ payload: { account: currentAddress, chainId } })
    yield put({
      type: 'TOKENS.SET_CURRENT_ETH_BALANCE',
      payload: {
        currentEthBalance: Math.round(ethBalanceFormatted * 1000) / 1000
      }
    })

    if (networkName === 'mainnet' || networkName === 'kovan') {
      const { address, tokens = [] } = yield call(getERC20Items, { address: currentAddress, networkName })
      const erc20Assets = tokens.map(item => item.tokenInfo)
      return yield put({ type: 'TOKENS.SET_ASSETS', payload: { assets: erc20Assets } })
    }

    if (networkName === 'xdai') {
      const { status = 0, result = [], message } = yield call(getXDAIERC20Items, { address: currentAddress, networkName })
      if (status && status === '1' && message === 'OK') {
        const erc20Assets = result.filter(asset => asset.type === 'ERC-20').map(item => {
          return {
            ...item,
            symbol: defineSymbol({ item, chainId }),
            decimals: defineDecimals({ decimals: item.decimals }),
            address: item.contractAddress
          }
        })
        yield put({ type: 'TOKENS.SET_ASSETS', payload: { assets: erc20Assets } })
      }
    }
    
  } catch (e) {
    console.error(e)
  }
}

export default generator
generator.selectors = {
  chainId: ({ user: { chainId } }) => chainId,
  currentAddress: ({ user: { currentAddress } }) => currentAddress
}

const defineDecimals = ({ decimals }) => {
  if (!decimals || decimals.length === 0) { return 0 }
  return Number(decimals)
}

const defineSymbol = ({ item, chainId }) => {
  if (Number(chainId) === 1 && item.contractAddress.toLowerCase() === '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359') {
    return 'SAI'
  }
  return item.symbol
}
