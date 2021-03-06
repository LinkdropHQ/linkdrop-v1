/* global describe, before, it */

import chai from 'chai'

import {
  createMockProvider,
  deployContract,
  solidity
} from 'ethereum-waffle'

import LinkdropFactory from '../build/LinkdropFactory'
import LinkdropMastercopy from '../build/LinkdropMastercopy'
import ERC721Mock from '../build/ERC721Mock'

import {
  computeProxyAddress,
  createLink,
  signReceiverAddress,
  computeBytecode
} from '../scripts/utils'

const ethers = require('ethers')

// Turn off annoying warnings
ethers.errors.setLogLevel('error')

chai.use(solidity)
const { expect } = chai

let provider = createMockProvider()

let [linkdropMaster, receiver, nonsender, linkdropSigner, relayer] = provider.getWallets(
  provider
)

let masterCopy
let factory
let proxy
let proxyAddress
let nftInstance

let link
let receiverAddress
let receiverSignature
let weiAmount
let nftAddress
let tokenId
let expirationTime
let version
let bytecode

const initcode = '0x6352c7420d6000526103ff60206004601c335afa6040516060f3'
const chainId = 4 // Rinkeby
const campaignId = 0

let feeReceiver

describe('ETH/ERC721 linkdrop tests', () => {
  before(async () => {
    nftInstance = await deployContract(linkdropMaster, ERC721Mock, [], { gasLimit: 5000000 })
  })

  it('should deploy master copy of linkdrop implementation', async () => {
    masterCopy = await deployContract(linkdropMaster, LinkdropMastercopy, [], {
      gasLimit: 6000000
    })
    expect(masterCopy.address).to.not.eq(ethers.constants.AddressZero)
  })

  it('should deploy factory', async () => {
    bytecode = computeBytecode(masterCopy.address)
    factory = await deployContract(
      linkdropMaster,
      LinkdropFactory,
      [masterCopy.address, chainId],
      {
        gasLimit: 6000000
      }
    )
    expect(factory.address).to.not.eq(ethers.constants.AddressZero)
    let version = await factory.masterCopyVersion()
    expect(version).to.eq(1)
  })

  it('should deploy proxy and delegate to implementation', async () => {
    // Compute next address with js function
    proxyAddress = computeProxyAddress(
      factory.address,
      linkdropMaster.address,
      campaignId,
      initcode
    )

    await expect(
      factory.deployProxy(campaignId, {
        gasLimit: 6000000
      })
    ).to.emit(factory, 'Deployed')

    proxy = new ethers.Contract(
      proxyAddress,
      LinkdropMastercopy.abi,
      linkdropMaster
    )

    feeReceiver = await proxy.feeReceiver()

    let linkdropMasterAddress = await proxy.linkdropMaster()
    expect(linkdropMasterAddress).to.eq(linkdropMaster.address)

    let version = await proxy.version()
    expect(version).to.eq(1)

    let owner = await proxy.owner()
    expect(owner).to.eq(factory.address)
  })

  it('linkdropMaster should be able to add new signing keys', async () => {
    let isSigner = await proxy.isLinkdropSigner(linkdropSigner.address)
    expect(isSigner).to.eq(false)
    await proxy.addSigner(linkdropSigner.address, { gasLimit: 500000 })
    isSigner = await proxy.isLinkdropSigner(linkdropSigner.address)
    expect(isSigner).to.eq(true)

    await proxy.addSigner(receiver.address, { gasLimit: 500000 })
  })

  it('non linkdropMaster should not be able to remove signing key', async () => {
    let proxyInstance = new ethers.Contract(
      proxyAddress,
      LinkdropMastercopy.abi,
      nonsender
    )

    let isSigner = await proxyInstance.isLinkdropSigner(receiver.address)
    expect(isSigner).to.eq(true)

    await expect(
      proxyInstance.removeSigner(receiver.address, { gasLimit: 500000 })
    ).to.be.revertedWith('ONLY_LINKDROP_MASTER')
    isSigner = await proxyInstance.isLinkdropSigner(receiver.address)
    expect(isSigner).to.eq(true)
  })

  it('linkdropMaster should be able to remove signing key', async () => {
    let isSigner = await proxy.isLinkdropSigner(receiver.address)
    expect(isSigner).to.eq(true)

    await proxy.removeSigner(receiver.address, { gasLimit: 500000 })

    isSigner = await proxy.isLinkdropSigner(receiver.address)
    expect(isSigner).to.eq(false)
  })

  it('should not revert while checking claim params with insufficient allowance', async () => {
    await linkdropMaster.sendTransaction({
      to: proxy.address,
      value: ethers.utils.parseEther('2')
    })

    factory = factory.connect(relayer)

    weiAmount = 0
    nftAddress = nftInstance.address
    tokenId = 1
    expirationTime = 11234234223
    version = 1

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.checkClaimParamsERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature
      )
    ).to.not.be.revertedWith('INSUFFICIENT_ALLOWANCE')
  })

  it('creates new link key and verifies its signature', async () => {
    let senderAddress = linkdropMaster.address

    let senderAddr = await proxy.linkdropMaster()
    expect(senderAddress).to.eq(senderAddr)

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    expect(
      await proxy.verifyLinkdropSignerSignatureERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        link.linkdropSignerSignature
      )
    ).to.be.true
  })

  it('signs receiver address with link key and verifies this signature onchain', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    expect(
      await proxy.verifyReceiverSignatureERC721(
        link.linkId,
        receiverAddress,
        receiverSignature
      )
    ).to.be.true
  })

  it('non-linkdropMaster should not be able to pause contract', async () => {
    let proxyInstance = new ethers.Contract(
      proxyAddress,
      LinkdropMastercopy.abi,
      nonsender
    )
    // Pausing
    await expect(proxyInstance.pause({ gasLimit: 500000 })).to.be.revertedWith(
      'ONLY_LINKDROP_MASTER'
    )
  })

  it('linkdropMaster should be able to pause contract', async () => {
    // Pausing
    await proxy.pause({ gasLimit: 500000 })
    let paused = await proxy.paused()
    expect(paused).to.eq(true)
  })

  it('linkdropMaster should be able to unpause contract', async () => {
    // Unpausing
    await proxy.unpause({ gasLimit: 500000 })
    let paused = await proxy.paused()
    expect(paused).to.eq(false)
  })

  it('linkdropMaster should be able to cancel link', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    await expect(proxy.cancel(link.linkId, { gasLimit: 200000 })).to.emit(
      proxy,
      'Canceled'
    )
    let canceled = await proxy.isCanceledLink(link.linkId)
    expect(canceled).to.eq(true)
  })

  it('should fail to claim nft when paused', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    // Pausing
    await proxy.pause({ gasLimit: 500000 })

    await expect(
      factory.checkClaimParamsERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature
      )
    ).to.be.revertedWith('LINKDROP_PROXY_CONTRACT_PAUSED')
  })

  it('should fail to claim nft not owned by proxy', async () => {
    // Unpause
    await proxy.unpause({ gasLimit: 500000 })

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.reverted
  })

  it('should fail to claim with insufficient allowance', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('revert ERC721: transfer caller is not owner nor approved')
  })

  it('should fail to claim nft by expired link', async () => {
    // Approving all tokens from linkdropMaster to Linkdrop Contract
    await nftInstance.setApprovalForAll(proxy.address, true)

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      0,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        0,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('LINK_EXPIRED')
  })

  it('should fail to claim nft with invalid contract version link', async () => {
    let invalidVersion = 0
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      invalidVersion,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('INVALID_LINKDROP_SIGNER_SIGNATURE')
  })

  it('should fail to claim nft with invalid chaind id', async () => {
    let invalidChainId = 0
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      invalidChainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('INVALID_LINKDROP_SIGNER_SIGNATURE')
  })

  it('should fail to claim nft which does not belong to linkdrop master', async () => {
    const unavailableTokenId = 13

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      unavailableTokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        unavailableTokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('LINKDROP_MASTER_DOES_NOT_OWN_TOKEN_ID')
  })

  it('should succesfully claim nft with valid claim params', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await factory.claimERC721(
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      link.linkId,
      linkdropMaster.address,
      campaignId,
      link.linkdropSignerSignature,
      receiverAddress,
      receiverSignature,
      { gasLimit: 800000 }
    )

    const owner = await nftInstance.ownerOf(tokenId)
    expect(owner).to.eq(receiverAddress)
  })

  it('should be able to check link claimed from factory instance', async () => {
    const claimed = await factory.isClaimedLink(
      linkdropMaster.address,
      campaignId,
      link.linkId
    )
    expect(claimed).to.eq(true)
  })

  it('should send fees to relayer if transaction is sponsored', async () => {
    let linkTokenId = 2
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      linkTokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)
    const proxyBalanceBefore = await provider.getBalance(
      proxy.address
    )
    const feeReceiverBalanceBefore = await provider.getBalance(
      feeReceiver
    )    
    
    await factory.claimERC721(
      weiAmount,
      nftAddress,
      linkTokenId,
      expirationTime,
      link.linkId,
      linkdropMaster.address,
      campaignId,
      link.linkdropSignerSignature,
      receiverAddress,
      receiverSignature,
      { gasLimit: 800000 }
    )


    const proxyBalanceAfter = await provider.getBalance(
      proxy.address
    )

    const feeReceiverBalanceAfter = await provider.getBalance(
      feeReceiver
    )    
    
    expect(proxyBalanceAfter).to.be.lt(proxyBalanceBefore)
    expect(feeReceiverBalanceAfter).to.be.gt(feeReceiverBalanceBefore)    
  })

  it('should NOT send fees to relayer if transaction is not sponsored', async () => {
    let linkTokenId = 3
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      linkTokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    
    receiverAddress = relayer.address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    const proxyBalanceBefore = await provider.getBalance(
      proxy.address
    )
    const feeReceiverBalanceBefore = await provider.getBalance(
      feeReceiver
    )    
    
    await factory.claimERC721(
      weiAmount,
      nftAddress,
      linkTokenId,
      expirationTime,
      link.linkId,
      linkdropMaster.address,
      campaignId,
      link.linkdropSignerSignature,
      receiverAddress,
      receiverSignature,
      { gasLimit: 800000 }
    )

    const proxyBalanceAfter = await provider.getBalance(
      proxy.address
    )
    const feeReceiverBalanceAfter = await provider.getBalance(
      feeReceiver
    )    
    
    expect(proxyBalanceAfter).to.eq(proxyBalanceBefore)
    expect(feeReceiverBalanceAfter).to.eq(feeReceiverBalanceBefore)    
  })

  it('should fail to claim link twice', async () => {
    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('LINK_CLAIMED')
  })

  it('should fail to claim nft with fake linkdropMaster signature', async () => {
    tokenId = 4

    let wallet = ethers.Wallet.createRandom()
    let linkId = wallet.address

    let message = ethers.utils.solidityKeccak256(['address'], [linkId])
    let messageToSign = ethers.utils.arrayify(message)
    let fakeSignature = await receiver.signMessage(messageToSign)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        linkId,
        linkdropMaster.address,
        campaignId,
        fakeSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('INVALID_LINKDROP_SIGNER_SIGNATURE')
  })

  it('should fail to claim nft with fake receiver signature', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    let fakeLink = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(
      fakeLink.linkKey, // signing receiver address with fake link key
      receiverAddress
    )
    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('INVALID_RECEIVER_SIGNATURE')
  })

  it('should fail to claim nft by canceled link', async () => {
    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )
    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await proxy.cancel(link.linkId, { gasLimit: 100000 })

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        campaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('LINK_CANCELED')
  })

  it('should be able to send ethers to proxy', async () => {
    let balanceBefore = await provider.getBalance(proxy.address)

    let wei = ethers.utils.parseEther('2')
    // send some eth
    let tx = {
      to: proxy.address,
      value: wei
    }
    await linkdropMaster.sendTransaction(tx)
    let balanceAfter = await provider.getBalance(proxy.address)
    expect(balanceAfter).to.eq(balanceBefore.add(wei))
  })

  it('should be able to withdraw ethers from proxy to linkdropMaster', async () => {
    let balanceBefore = await provider.getBalance(proxy.address)
    expect(balanceBefore).to.not.eq(0)
    await proxy.withdraw({ gasLimit: 200000 })
    let balanceAfter = await provider.getBalance(proxy.address)
    expect(balanceAfter).to.eq(0)
  })

  it('should succesfully claim eth and nft simulteneously', async () => {
    tokenId = 4

    weiAmount = 15 // wei

    // Send ethers to Linkdrop contract
    let tx = {
      to: proxy.address,
      value: ethers.utils.parseUnits('1')
    }
    await linkdropMaster.sendTransaction(tx)

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await factory.claimERC721(
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      link.linkId,
      linkdropMaster.address,
      campaignId,
      link.linkdropSignerSignature,
      receiverAddress,
      receiverSignature,
      { gasLimit: 800000 }
    )

    let owner = await nftInstance.ownerOf(tokenId)
    expect(owner).to.eq(receiverAddress)

    let receiverEthBalance = await provider.getBalance(receiverAddress)
    expect(receiverEthBalance).to.eq(weiAmount)
  })

  it('should succesfully claim nft and deploy proxy if not deployed yet', async () => {
    const newCampaignId = 2
    tokenId = 3

    nftAddress = nftInstance.address
    expirationTime = 11234234223
    version = 1

    proxyAddress = await computeProxyAddress(
      factory.address,
      linkdropMaster.address,
      newCampaignId,
      initcode
    )

    // Contract not deployed yet
    proxy = new ethers.Contract(
      proxyAddress,
      LinkdropMastercopy.abi,
      linkdropMaster
    )

    await linkdropMaster.sendTransaction({
      to: proxy.address,
      value: ethers.utils.parseEther('2')
    })

    link = await createLink(
      linkdropSigner,
      weiAmount,
      nftAddress,
      tokenId,
      expirationTime,
      version,
      chainId,
      proxyAddress
    )

    receiverAddress = ethers.Wallet.createRandom().address
    receiverSignature = await signReceiverAddress(link.linkKey, receiverAddress)

    await expect(
      factory.claimERC721(
        weiAmount,
        nftAddress,
        tokenId,
        expirationTime,
        link.linkId,
        linkdropMaster.address,
        newCampaignId,
        link.linkdropSignerSignature,
        receiverAddress,
        receiverSignature,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('LINKDROP_PROXY_CONTRACT_NOT_DEPLOYED')
  })
})
