pragma solidity ^0.5.2;

interface PriceSource {
    event ChangePrice(uint256 oldPrice, uint256 newPrice);

    function getPrice() external view returns (uint256 price);
}