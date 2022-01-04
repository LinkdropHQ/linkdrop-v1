pragma solidity >=0.6.0 <0.8.0;

interface ILinkdropERC20 {

    function checkClaimParams
    (
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,
        address _receiver
    )
    external view returns (bool);

    function claimERC20
    (
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,
        address payable _receiver
    )
    external returns (bool);

    function encodeClaimERC20(
        uint _weiAmount,
        address _tokenAddress,
        uint _tokenAmount,
        uint _expiration,
        address _linkId,        
        address payable _receiver                              
                              ) external view returns(bytes memory);
    
}
