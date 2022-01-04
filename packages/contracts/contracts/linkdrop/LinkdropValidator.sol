//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
import "../interfaces/IValidator.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";


contract LinkdropValidator is IValidator {
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
      bytes4 sig = data[0] |  bytes4(data[1]) >> 8 | bytes4(data[2]) >> 16  | bytes4(data[3]) >> 24;
      require(sig == 0x91b025f6, "wrong sig");

      // only pre-defined functions are allowed
      if (sig == 0x91b025f6) { // claimERC20 selector
        (bool success, bytes memory responsedata) = address(this).call(data);
        require(success, "claim ERC20 failed");
      } else {
        revert("Unknown function!");
      }
    }
}
