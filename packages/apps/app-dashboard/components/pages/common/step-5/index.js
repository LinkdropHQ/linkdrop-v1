/* global Image */
import React from 'react'
import { ethers, utils } from 'ethers'
import { actions, translate } from 'decorators'
import styles from './styles.module'
import classNames from 'classnames'
import { Button, PageHeader, PageLoader } from 'components/common'
import { Icons } from '@linkdrop/ui-kit'
import { defineNetworkName, convertFromExponents } from '@linkdrop/commons'
import { getImages, defineDefaultSymbol } from 'helpers'
import { factory } from 'app.config.js'

@actions(({ user: { loading, chainId }, campaigns: { items, current } }) => ({ chainId, items, current, loading }))
@translate('pages.campaignCreate')
class Step5 extends React.Component {
  constructor (props) {
    super(props)
    const { chainId } = this.props
    this.defaultSymbol = defineDefaultSymbol({ chainId })
  }

  render () {
    const { items, current, campaignToCheck, loading, chainId } = this.props
    const currentCampaign = items.find(item => item.id === (campaignToCheck || current))
    const links = (currentCampaign || {}).links
    const images = getImages({ src: 'claim-page' })
    if (!currentCampaign) { return null }
    const { currentAddress, campaignId, privateKey, tokenAmount, ethAmount, tokenAddress, tokenDecimals, tokenType } = currentCampaign
    const weiAmount = utils.parseEther(convertFromExponents(ethAmount || 0))
    const tokenAmountFormatted = utils.parseUnits(
      String(tokenAmount || 0),
      tokenDecimals || 0
    )
    return <div className={styles.container}>
      <PageHeader title={this.t('titles.getTheLinks')} />
      {loading && <PageLoader />}
      <div className={styles.content}>
        <div className={styles.automatic}>

          <p className={styles.text}>{this.t('titles.linkdropSdk')}</p>
          <p className={classNames(styles.text, styles.textGrey, styles.textMargin40)}>{this.t('titles.automaticDistribution')}</p>

          <Button onClick={_ => window.open('https://github.com/LinkdropProtocol/linkdrop-monorepo/tree/master/packages/sdk', '_blank')} className={classNames(styles.button, styles.buttonMargin40, styles.buttonWithImg)}>
            <span>{this.t('buttons.useLinkdropSdk')}</span><Icons.ExternalLink fill='#FFF' />
          </Button>
          <p className={classNames(styles.text, styles.textMargin80)}>{this.t('titles.nodeJsSupport')}</p>
          <p className={classNames(styles.text, styles.textMargin20)}>{this.t('titles.codeDetails')}</p>
          <xmp className={styles.codeBlock}>
            {this.renderInstructions ({ chainId, currentAddress, factory, campaignId, tokenAmount, tokenAmountFormatted, privateKey, ethAmount, tokenAddress, weiAmount })}
          </xmp>
        </div>
        <div className={styles.manual}>
          <p className={styles.text}>{this.t('titles.downloadFile')}</p>
          <p className={classNames(styles.text, styles.textGrey, styles.textMargin40)}>{this.t('titles.manual')}</p>
          <div className={styles.buttonsContainer}>
            <Button onClick={_ => links && this.actions().campaigns.getCSV({ links, id: campaignToCheck || current })} className={styles.button}>{this.t('buttons.downloadCsv')}</Button>
          </div>
          <p
            onClick={e => {
              if (e.target.tagName === 'A') {
                e.preventDefault()
                const image = new Image()
                image.src = e.target.getAttribute('href')
                const w = window.open('')
                w.document.write(image.outerHTML)
              }
            }} className={classNames(styles.text, styles.textMargin60)} dangerouslySetInnerHTML={{ __html: this.t('titles.howToClaimPreview', { href: images.image }) }}
          />
          <p className={classNames(styles.text, styles.textMargin20)} dangerouslySetInnerHTML={{ __html: this.t('titles.visitHelpCenter', { href: 'https://www.notion.so/Help-Center-9cf549af5f614e1caee6a660a93c489b' }) }} />
        </div>
      </div>
      <div>
        <p className={classNames(styles.text, styles.textMargin20)}>{this.t('titles.contractParams')}</p>
        <p className={classNames(styles.text, styles.textMargin10, styles.ellipsis)} dangerouslySetInnerHTML={{ __html: this.t('titles.masterAddress', { address: currentAddress }) }} />
        <p className={classNames(styles.text, styles.textMargin10, styles.ellipsis)} dangerouslySetInnerHTML={{ __html: this.t('titles.factoryAddress', { address: factory }) }} />
        <p className={classNames(styles.text, styles.textMargin10, styles.ellipsis)} dangerouslySetInnerHTML={{ __html: this.t('titles.signingKey', { signingKey: privateKey }) }} />
        <p className={classNames(styles.text, styles.ellipsis)} dangerouslySetInnerHTML={{ __html: this.t('titles.campaignId', { campaignId }) }} />
      </div>
    </div>
  }


  renderInstructions ({ tokenType, chainId, currentAddress, factory, campaignId, tokenAmount, tokenAmountFormatted, privateKey, ethAmount, tokenAddress, weiAmount }) {
    const data = {
      chain: defineNetworkName({ chainId }),
      masterAddress: currentAddress,
      campaignId: campaignId,
      linkdropSigner: privateKey,
      symbol: this.defaultSymbol,
      weiAmount: ethAmount ? weiAmount : 0,
      tokenAddress: tokenAddress || ethers.constants.AddressZero,
      tokenAmount: tokenAmount ? tokenAmountFormatted : 0,
      factoryAddress: factory
    }
    if (tokenType === 'erc20' || tokenType === 'eth') {
      return this.t(`texts.codeBlockErc20`, data)
    }
    if (tokenType === 'erc721') {
      return this.t(`texts.codeBlockErc721`, data)
    }
    return this.t(`texts.codeBlockErc1155`, data)
  }
}

export default Step5
