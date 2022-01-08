import { task } from 'hardhat/config';
import { deployAaveProtocolDataProvider } from '../../helpers/contracts-deployments';
import { exit } from 'process';
import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';

task('full:data-provider', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    try {
      await localBRE.run('set-DRE');

      const addressesProvider = await getLendingPoolAddressesProvider();

      await deployAaveProtocolDataProvider(addressesProvider.address, verify);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });
/**
 * 1_address_provider
 * 1. 完成provider部署
 * 2. 如果需要部署registry，则会重新部署registry，同时注册到provider中
 * 3. 设置admain，使用部署账户的0地址
 * 2_lending_pool
 * 1. 部署lendingPool，执行initialize(provider)
 * 2. provider设置setLendingPoolImpl(lendingPool)
 * 3. 部署：poolConfig，deployLendingPoolConfigurator
 * 4. provider设置setLendingPoolConfiguratorImpl(poolConfig)
 * 5. 通过 poolConfig 暂停market市场
 * 部署两个helpers:
 * 6. deployStableAndVariableTokensHelper(lendingPoolProxy, addressesProvider)
 * 7. deployATokensAndRatesHelper(lendingPoolProxy, addressesProvider)
 * 8. deployATokenImplementations
 * 3_oracles
 * 1. 部署oracle：deployAaveOracle
 * 2. 向aaveOracle中设置token的价格数据：setAssetSources(tokens, aggregators)
 * (通过：getPairsTokenAggregator读取index.ts的)
 * 3. 部署deployLendingRateOracle，如果未配置地址，则重新部署，同时使用固定值common作为borrowRate
 * 4. 初始化：setInitialMarketRatesInRatesOracleByHelper()
 * 向provider中设置oracle
 * 5. addressesProvider.setPriceOracle()
 * 6. addressesProvider.setLendingRateOracle()
 * 4_data-provider
 * 1. 部署data provider，传入provider作为参数即可
 * **/
