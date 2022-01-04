//SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

interface IValidator {
  function claim(address beneficiary, bytes memory data, bytes memory authsig, bytes memory claimsig) external;
  function isIssuer (address _issuer) external view returns (bool);
}
