pragma solidity ^0.5.2;

interface AggregatorInterface {
    function currentAnswer() external view returns (int256);
    function updatedHeight() external view returns (uint256);
}

import "./PriceSource.sol";

contract ChainlinkAggregatorPriceSource is PriceSource {
    uint256 private _price;
    AggregatorInterface private _aggregator;

    constructor(address aggregator) public {
        _aggregator = AggregatorInterface(aggregator);

        loadPrice();
    }

    function getPrice() external view returns (uint256 price) {
        return _price;
    }

    function loadPrice() private {
        int256 aggregatorPrice = _aggregator.currentAnswer();

        require(aggregatorPrice > 0, "Aggregator reporting non-positive price");

        _price = uint256(aggregatorPrice) * 1e10;

        assert(_price > uint256(aggregatorPrice));
    }

    function updatePrice() external {
        uint256 oldPrice = _price;

        loadPrice();

        emit ChangePrice(oldPrice, _price);
    }
}