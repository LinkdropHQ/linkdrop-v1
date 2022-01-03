//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";


interface IValidator {
  function claim(address beneficiary, bytes memory data, bytes memory authsig, bytes memory claimsig) external;
  /* function addIssuer (address _issuer) internal; */
  /* function removeIssuer (address _issuer) internal; */
  function isIssuer (address _issuer) external view returns (bool);
  /* function checkData(address beneficiary, bytes memory data) internal; */
  /* function takeClaimAction(address beneficiary, bytes memory data) internal; */
}


contract Validator is IValidator {
    mapping(address=>bool) issuers;


    function addIssuer (address _issuer) internal {
      issuers[_issuer] = true;
    }

    function removeIssuer (address _issuer) internal {
      issuers[_issuer] = false;
    }

    function isIssuer (address _issuer) public view override returns (bool) {
      return issuers[_issuer];
    }
    
    function claim(address beneficiary, bytes memory data, bytes memory authsig, bytes memory claimsig) external override {

      bytes32 claimhash = ECDSA.toEthSignedMessageHash(
                                                       keccak256(
                                                                 abi.encodePacked(
                                                                                  hex"1900",
                                                                                  address(this),
                                                                                  byte(0x80),
                                                                                  keccak256(authsig),
                                                                                  beneficiary
                                                                                  )
                                                                 )
                                                       );
      
      address claimant = ECDSA.recover(claimhash, claimsig);           
      
      bytes32 authhash =  ECDSA.toEthSignedMessageHash(
                                                       keccak256(
                                                                 abi.encodePacked(
                                                                                  hex"1900",
                                                                                  address(this),
                                                                                  byte(0x00),
                                                                                  keccak256(data),
                                                                                  claimant
                                                                                  )
                                                                 )
                                                       );
      
                                                       
        
      address issuer = ECDSA.recover(authhash, authsig);
              
      require(issuers[issuer], "Issuer is not authorized");
      //Conduct checks on `data` here, and take action if they pass.
      require(1 == 2, "Not Implemented");

    }
}
