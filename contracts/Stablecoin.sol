pragma solidity ^0.5.2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "./PriceSource.sol";

contract Stablecoin is ERC20, ERC20Detailed {
    PriceSource private _ethPriceSource;
    PriceSource private _tokenPriceSource;

    uint256 private _minimumCollateralPercentage;

    uint256 private _nextVaultID;

    mapping(uint256 => bool) vaultExistance;
    mapping(uint256 => address) vaultOwner;
    mapping(uint256 => uint256) vaultCollateral;
    mapping(uint256 => uint256) vaultDebt;

    mapping(address => uint256[]) ownerVaults;

    constructor(
        address ethPriceSource,
        address tokenPriceSource,
        uint256 minimumCollateralPercentage,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20Detailed(name, symbol, decimals) public {
        _ethPriceSource = PriceSource(ethPriceSource);
        _tokenPriceSource = PriceSource(tokenPriceSource);
        _minimumCollateralPercentage = minimumCollateralPercentage;
    }

    function createVault() external returns (uint256) {
        uint256 id = _nextVaultID;
        _nextVaultID += 1;

        assert(_nextVaultID > id);

        vaultExistance[id] = true;
        vaultOwner[id] = msg.sender;

        ownerVaults[msg.sender].push(id);

        return id;
    }

    function depositCollateral(uint256 vaultID) external payable {
        require(vaultExistance[vaultID], "Vault does not exist");
        require(vaultOwner[vaultID] == msg.sender, "Vault is not owned by you");

        uint256 newCollateral = vaultCollateral[vaultID] + msg.value;

        assert(newCollateral > vaultCollateral[vaultID]);

        vaultCollateral[vaultID] = newCollateral;
    }

    function withdrawCollateral(uint256 vaultID, uint256 amount) external {
        require(vaultExistance[vaultID], "Vault does not exist");
        require(vaultOwner[vaultID] == msg.sender, "Vault is not owned by you");
        require(vaultCollateral[vaultID] >= amount, "Vault does not have enough collateral");

        uint256 newCollateral = vaultCollateral[vaultID] - amount;

        if(vaultDebt[vaultID] != 0) {
            uint256 newCollateralCent = newCollateral * 100;

            assert(newCollateralCent > newCollateral);

            uint256 newCollateralPercentage = newCollateralCent / vaultDebt[vaultID];

            require(newCollateralPercentage < _minimumCollateralPercentage, "Withdrawal would put vault below minimum collateral percentage");
        }

        vaultCollateral[vaultID] = newCollateral;
        msg.sender.transfer(amount);
    }

    function borrowToken(uint256 vaultID, uint256 amount) external {
        require(amount > 0, "Must borrow non-zero amount");
        require(vaultExistance[vaultID], "Vault does not exist");
        require(vaultOwner[vaultID] == msg.sender, "Vault is not owned by you");

        uint256 newDebt = vaultDebt[vaultID] + amount;

        assert(newDebt > vaultDebt[vaultID]);

        uint256 collateralCent = vaultCollateral[vaultID] * 100;

        assert(collateralCent > vaultCollateral[vaultID]);

        uint256 newCollateralPercentage = collateralCent / newDebt;

        require(newCollateralPercentage < _minimumCollateralPercentage, "Borrow would put vault below minimum collateral percentage");

        vaultDebt[vaultID] = newDebt;
        _mint(msg.sender, amount);
    }

    function payBackToken(uint256 vaultID, uint256 amount) external {
        require(vaultExistance[vaultID], "Vault does not exist");
        require(vaultOwner[vaultID] == msg.sender, "Vault is not owned by you");
        require(balanceOf(msg.sender) >= amount, "Token balance too low");
        require(vaultDebt[vaultID] >= amount, "Vault debt less than amount to pay back");

        vaultDebt[vaultID] -= amount;
        _burn(msg.sender, amount);
    }
}