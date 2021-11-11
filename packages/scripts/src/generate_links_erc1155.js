import ERC1155Mock from '../../contracts/build/ERC1155Mock'
import LinkdropSDK from '@linkdrop/sdk'

import ora from 'ora'
import { terminal as term } from 'terminal-kit'
import { ethers } from 'ethers'
import path from 'path'
import fastcsv from 'fast-csv'
import fs from 'fs'
import {
  newError,
  getString,
  getInt,
  getProvider,
  getExpirationTime,
  getLinkdropMasterWallet
} from './utils'
import deployProxyIfNeeded from './deploy_proxy'

ethers.errors.setLogLevel('error')

const JSON_RPC_URL = getString('jsonRpcUrl')
const CHAIN = getString('CHAIN')
const LINKDROP_MASTER_PRIVATE_KEY = getString('linkdropMasterPrivateKey')
let WEI_AMOUNT = getInt('weiAmount')
const EXPIRATION_TIME = getExpirationTime()
const NFT_ADDRESS = getString('nftAddress')
const NFT_IDS = getString('nftIds')
const PROVIDER = getProvider()
const LINKDROP_MASTER_WALLET = getLinkdropMasterWallet()
const CAMPAIGN_ID = getInt('CAMPAIGN_ID')
const FACTORY_ADDRESS = getString('FACTORY_ADDRESS')
const DEFAULT_WALLET = getString('DEFAULT_WALLET')

const GAS_FEE = ethers.utils.parseUnits('0.002')

WEI_AMOUNT = ethers.utils.bigNumberify(WEI_AMOUNT.toString())

// Initialize linkdrop SDK
const linkdropSDK = new LinkdropSDK({
  linkdropMasterAddress: new ethers.Wallet(LINKDROP_MASTER_PRIVATE_KEY).address,
  factoryAddress: FACTORY_ADDRESS,
  chain: CHAIN,
  jsonRpcUrl: JSON_RPC_URL
})

export const generate = async () => {
  let spinner, tx
  try {
    spinner = ora({
      text: term.bold.green.str('Generating links'),
      color: 'green'
    })
    spinner.start()

    const proxyAddress = linkdropSDK.getProxyAddress(CAMPAIGN_ID)

    console.log({ proxyAddress })
    
    // check that proxy address is deployed
    await deployProxyIfNeeded(spinner)

    const nftContract = await new ethers.Contract(
      NFT_ADDRESS,
      ERC1155Mock.abi,
      LINKDROP_MASTER_WALLET
    )
    
    // If owner of tokenId is not proxy contract -> send it to proxy
    const tokenIds = JSON.parse(NFT_IDS)

    console.log("checking for approved...")
    
    // Approve tokens
    const isApprovedForAll = await nftContract.isApprovedForAll(
      LINKDROP_MASTER_WALLET.address,
      proxyAddress
    )


    console.log({ isApprovedForAll })
    
    if (!isApprovedForAll) {
      spinner.info(
        term.bold.str(`Approving all ${nftContract.address} to ^g${proxyAddress}`)
      )

      tx = await nftContract.setApprovalForAll(proxyAddress, true, {
        gasLimit: 500000
      })
      term.bold(`Tx Hash: ^g${tx.hash}\n`)
    }

    if (WEI_AMOUNT.gt(0)) {
      // Transfer ethers
      const cost = WEI_AMOUNT.mul(tokenIds.length)
      let amountToSend

      const tokenSymbol = 'ETH'
      const tokenDecimals = 18
      const proxyBalance = await PROVIDER.getBalance(proxyAddress)

      if (proxyBalance.lt(cost)) {
        amountToSend = cost.sub(proxyBalance)

        spinner.info(
          term.bold.str(
            `Sending ${amountToSend /
              Math.pow(10, tokenDecimals)} ${tokenSymbol} to ^g${proxyAddress}`
          )
        )

        tx = await LINKDROP_MASTER_WALLET.sendTransaction({
          to: proxyAddress,
          value: amountToSend,
          gasLimit: 33000
        })

        term.bold(`Tx Hash: ^g${tx.hash}\n`)
      }
    }


    // Generate links
    const links = []

    for (let i = 0; i < tokenIds.length; i++) {
      const {
        url,
        linkId,
        linkKey,
        linkdropSignerSignature
      } = await linkdropSDK.generateLinkERC1155({
        signingKeyOrWallet: LINKDROP_MASTER_PRIVATE_KEY,
        weiAmount: WEI_AMOUNT,
        nftAddress: NFT_ADDRESS,
        tokenId: tokenIds[i],
        tokenAmount: "1",
        expirationTime: EXPIRATION_TIME,
        campaignId: CAMPAIGN_ID,
        wallet: DEFAULT_WALLET
      })

      const link = { i, linkId, linkKey, linkdropSignerSignature, url }
      links.push(link)
    }

    // Save links
    const dir = path.join(__dirname, '../output')
    const filename = path.join(dir, 'linkdrop_erc1155.csv')

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
      }
      const ws = fs.createWriteStream(filename)
      fastcsv.write(links, { headers: true }).pipe(ws)
    } catch (err) {
      throw newError(err)
    }

    spinner.succeed(term.bold.str(`Generated and saved links to ^_${filename}`))

    return links
  } catch (err) {
    spinner.fail(term.bold.red.str('Failed to generate links'))
    throw newError(err)
  }
}

generate()
