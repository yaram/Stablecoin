pragma solidity ^0.5.2;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./Stablecoin.sol";

contract TestStablecoin is Stablecoin, Ownable {
    constructor(
        address ethPriceSourceAddress,
        address tokenPriceSourceAddress,
        uint256 minimumCollateralPercentage,
        string memory name,
        string memory symbol
    ) Stablecoin(
        ethPriceSourceAddress,
        tokenPriceSourceAddress,
        minimumCollateralPercentage,
        name,
        symbol
    ) public {

    }

    function mint(address account, uint256 amount) external onlyOwner() {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external onlyOwner() {
        _burn(account, amount);
    }
}