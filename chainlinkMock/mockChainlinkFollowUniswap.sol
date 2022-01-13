// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
import './IUniswapV2Pair.sol';
import './IERC20.sol';

contract MockAggregator {
  uint256 private _latestAnswer;
  string public symbol;
  address public addr;
  uint256 public decimals;
  mapping(bytes32 => address) symbolPairs;

  bytes32 ETH = keccak256(abi.encodePacked('ETH'));
  bytes32 DAI = keccak256(abi.encodePacked('DAI'));
  bytes32 WBTC = keccak256(abi.encodePacked('WBTC'));
  bytes32 CHAINLINK = keccak256(abi.encodePacked('CHAINLINK'));

  /*
  dai：0x749B1c911170A5aFEb68d4B278cD5405C718fc7F
  比dai大：
  1. 0xd0a1e359811322d97991e03f863a0c30c2cf029c
  2. 0xb450d49CaF849875d63ADDdd5868EC1A8bfF2d29

  比dai小
  1. 0x5D14d5F575a8B17801633fccaa5C0Ed78e657BdA
  */

  //dai: token0
  //eth: token1
  address public ethDaiPairAddr = 0xc2a84f8e6a1a6011ccE0854C482217def6FbA8eE;
  address public wbtcDaiPairAddr = 0x7a30b9AAe79374c440D5f7A0388696C8bfB76677;
  address public chainlinkDaiPairAddr = 0xCdD4b06f6FF77B8D338FAB21606B8356A1C7ed14;
  address public daiAddr = 0x749B1c911170A5aFEb68d4B278cD5405C718fc7F;

  constructor(string memory _symbol, uint256 _decimals) public {
    symbolPairs[ETH] = ethDaiPairAddr;
    symbolPairs[DAI] = ethDaiPairAddr;
    symbolPairs[WBTC] = wbtcDaiPairAddr;
    symbolPairs[CHAINLINK] = chainlinkDaiPairAddr;

    bytes32 symbol_ = keccak256(abi.encodePacked(_symbol));
    require(symbolPairs[symbol_] != address(0), 'not support token symbol!');
    symbol = _symbol;
    decimals = _decimals;
  }

  function latestAnswer() external view returns (uint256) {
    bytes32 symbol_ = keccak256(abi.encodePacked(symbol));

    if (symbol_ == ETH) {
      (uint256 priceTmp, uint256 decimalsTmp) = getTokenPriceToDai(ethDaiPairAddr);
      return (priceTmp * 10**decimals) / 10**decimalsTmp;
    } else if (symbol_ == DAI) {
      return 10000000000000; //1$
    } else {
      return getTokenPriceToEth(symbolPairs[symbol_]);
    }
  }

  // calculate price based on pair reserves
  function getTokenPriceToEth(address pairAddress) public view returns (uint256) {
    //数量，这个币种的精度，wbc，8；chainlink，18
    (uint256 toDaiPrice, uint256 decimals1) = getTokenPriceToDai(pairAddress);
    (uint256 daiEthPrice, uint256 decimals2) = getTokenPriceToDai(ethDaiPairAddr);
    return ((toDaiPrice / decimals1) * 10**decimals) / (daiEthPrice / 10**decimals2);
  }

  // calculate price based on pair reserves
  function getTokenPriceToDai(address pairAddress) public view returns (uint256, uint256) {
    IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
    IERC20 token0 = IERC20(pair.token0());
    IERC20 token1 = IERC20(pair.token1());

    (uint256 Res0, uint256 Res1, ) = pair.getReserves();
    if (address(token0) == daiAddr) {
      //dai地址小,eth, link
      uint256 res0 = Res0 * (10**token1.decimals());

      //103453 * 10^decimals
      return (res0 / Res1, token0.decimals());
    }

    uint256 res1 = Res1 * (10**token0.decimals());
    return (res1 / Res0, token1.decimals());
  }
}
