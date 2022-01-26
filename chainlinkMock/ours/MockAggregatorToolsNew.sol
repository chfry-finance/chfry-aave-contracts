pragma solidity 0.6.12;
import './lib/EnumerableMap.sol';

contract MockAggregatorTools {
  using EnumerableMap for EnumerableMap.AddressToAddressMap;

  address public manager;
  EnumerableMap.AddressToAddressMap private assetToAggregator;

  constructor() public {
    manager = msg.sender;
  }

  modifier onlyManager() {
    require(msg.sender == manager, 'permission denied!');
    _;
  }

  function set(address  _asset, address _aggregator) public onlyManager {
    assetToAggregator.set(_asset, _aggregator);
  }

  function remove(address _asset) external onlyManager {
    assetToAggregator.remove(_asset);
  }

  function get(address _asset) public view returns(address) {
    return assetToAggregator.get(_asset);
  }

  function contains(address _asset) public view returns (bool) {
    return assetToAggregator.contains(_asset);
  }

  function length() public view returns(uint256) {
    return assetToAggregator.length();
  }

  function at(uint256 _index) public view returns(address, address) {
    return assetToAggregator.at(_index);
  }

  function list() public view returns(address[] memory _assets, address[] memory _aggregator){
    uint256 len = length();
    _assets = new address[](len);
    _aggregator = new address[](len);

    for (uint256 index = 0; index < len; index++) {
     (address key, address value) = assetToAggregator.at(index);
     _assets[index] = key;
     _aggregator[index] = value;
    }    
  }
}
