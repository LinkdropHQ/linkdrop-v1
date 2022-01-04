pragma solidity >=0.6.0 <0.8.0;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../interfaces/ILinkdropERC20.sol";
import "./LinkdropCommon.sol";

contract LinkdropERC20 is ILinkdropERC20, LinkdropCommon {
  
    using SafeMath for uint;    
        
    /**
    * @dev Function to verify claim params and make sure the link is not claimed or canceled
    * @param _weiAmount Amount of wei to be claimed
    * @param _tokenAddress Token address
    * @param _tokenAmount Amount of tokens to be claimed (in atomic value)
    * @param _expiration Unix timestamp of link expiration time
    * @param _linkId Address corresponding to link key
    * @param _receiver Address of linkdrop receiver
    * @return True if success
    */
    function checkClaimParams
    (
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,        
        address _receiver
     )
    public view
    override       
    whenNotPaused
    returns (bool)
    {
        // If tokens are being claimed
        if (_tokenAmount > 0) {
            require(_tokenAddress != address(0), "INVALID_TOKEN_ADDRESS");
        }

        // Make sure link is not claimed
        require(isClaimedLink(_linkId) == false, "LINK_CLAIMED");
        
        /* // Make sure link is not canceled */
        require(isCanceledLink(_linkId) == false, "LINK_CANCELED");

        // Make sure link is not expired
        require(_expiration >= now, "LINK_EXPIRED");

        // Make sure eth amount is available for this contract
        require(address(this).balance >= _weiAmount, "INSUFFICIENT_ETHERS");

        // Make sure tokens are available for this contract
        if (_tokenAddress != address(0)) {
            require
            (
                IERC20(_tokenAddress).balanceOf(linkdropMaster) >= _tokenAmount,
                "INSUFFICIENT_TOKENS"
            );

            require
            (
                IERC20(_tokenAddress).allowance(linkdropMaster, address(this)) >= _tokenAmount, "INSUFFICIENT_ALLOWANCE"
            );
        }

        return true;
    }

    /**
    * @dev Function to claim ETH and/or ERC20 tokens. Can only be called when contract is not paused
    * @param _weiAmount Amount of wei to be claimed
    * @param _tokenAddress Token address
    * @param _tokenAmount Amount of tokens to be claimed (in atomic value)
    * @param _expiration Unix timestamp of link expiration time
    * @param _linkId Address corresponding to link key
    * @param _receiver Address of linkdrop receiver
    * @return True if success
    */
    function claimERC20
    (
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,
        address payable _receiver
    )
    external
    override
    onlySelf
    whenNotPaused
    returns (bool)
    {


      
        // Make sure params are valid
        require
        (
            checkClaimParams
            (
                _weiAmount,
                _tokenAddress,
                _tokenAmount,
                _expiration,
                _linkId,
                _receiver
            ),
            "INVALID_CLAIM_PARAMS"
        );

        /* // Mark link as claimed */
        claimedTo[_linkId] = _receiver;

        // Make sure transfer succeeds
        require(_transferFunds(_weiAmount, _tokenAddress, _tokenAmount, _receiver), "TRANSFER_FAILED");

        // Emit claim event
        emit Claimed(_linkId, _weiAmount, _tokenAddress, _tokenAmount, _receiver);

        return true;
    }

    function encodeClaimERC20(
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,
        address payable _receiver                              
      ) public view override returns(bytes memory) {
      return abi.encodeWithSelector(
                                    LinkdropERC20.claimERC20.selector,
                                    _weiAmount,
                                    _tokenAddress,
                                    _tokenAmount,
                                    _expiration,
                                    _linkId,
                                    _receiver
                                    );
    }
    
    
    /**
    * @dev Internal function to transfer ethers and/or ERC20 tokens
    * @param _weiAmount Amount of wei to be claimed
    * @param _tokenAddress Token address
    * @param _tokenAmount Amount of tokens to be claimed (in atomic value)
    * @param _receiver Address to transfer funds to
    * @return True if success
    */
    function _transferFunds
    (
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        address payable _receiver
    )
    internal returns (bool)
    {

      // should send fees to fee receiver
      if (tx.origin != _receiver) { 
        feeReceiver.transfer(sponsoredFeeAmount);
      }
      
        // Transfer ethers
        if (_weiAmount > 0) {
            _receiver.transfer(_weiAmount);
        }

        // Transfer tokens
        if (_tokenAmount > 0) {
            IERC20(_tokenAddress).transferFrom(linkdropMaster, _receiver, _tokenAmount);
        }

        return true;
    }

}
