import { Artifact } from 'hardhat/types';
// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");

async function main() {

  const [owner] = await ethers.getSigners();

  // 定义常量
  const daiAddress = '0x749B1c911170A5aFEb68d4B278cD5405C718fc7F';
  const collateralTokenAddress = '0xF7190d0ed47b3E081D16925396A03363DdB82281';
  const receiveATokens = true;
  const borrower = "0xF7fedbBC7Ba70B5Da15CBB661CB52720Bfe01239";
  const poolProviderAddr = '0x8bD206df9853d23bE158A9F7065Cf60A7A5F05DF'

  const lendingPoolProvider = await ethers.getContractAt("ILendingPoolAddressesProvider", poolProviderAddr);

  // 获取 lpAddressProvider 实列
  const lpAddress = await lendingPoolProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt("ILendingPool", lpAddress, owner);
  console.log('lendingPool:', lendingPool.address);
  console.log("Get lpAddress successfully");

  // 获取 dai 实列
  const tokenInstance = await ethers.getContractAt("MintableERC20", daiAddress, owner);
  const tx = await tokenInstance.approve(lpAddress, ethers.utils.parseEther("10000"));
  await tx.wait()
  console.log("Approve Dai token successfully");

  // 获取 lp 实列
  const liquidationAmount = 10 ** 10;
  let liuquidateRecipt = await lendingPool.liquidationCall(collateralTokenAddress, daiAddress, borrower, liquidationAmount, receiveATokens);
  await liuquidateRecipt.wait();
  console.log(liuquidateRecipt);
  console.log("Finish liquidation")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
